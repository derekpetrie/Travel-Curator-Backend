import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCollectionSchema, insertPostSchema, insertPlaceSchema } from "@shared/schema";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Collections
  app.get("/api/collections", async (req, res) => {
    try {
      const collections = await storage.getCollections();
      res.json(collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  app.get("/api/collections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const collection = await storage.getCollection(id);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      res.json(collection);
    } catch (error) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  app.post("/api/collections", async (req, res) => {
    try {
      const parsed = insertCollectionSchema.parse(req.body);
      const collection = await storage.createCollection(parsed);
      res.json(collection);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(400).json({ error: "Invalid collection data" });
    }
  });

  app.delete("/api/collections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCollection(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // Posts
  app.get("/api/collections/:collectionId/posts", async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const posts = await storage.getPosts(collectionId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/collections/:collectionId/posts", async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Fetch metadata using oEmbed
      const metadata = await fetchMetadata(url);
      
      const postData = {
        collectionId,
        source: metadata.source,
        url: url,
        thumbnailUrl: metadata.thumbnailUrl,
        caption: metadata.caption,
        author: metadata.author,
        metadataJson: metadata.raw,
      };

      const parsed = insertPostSchema.parse(postData);
      const post = await storage.createPost(parsed);

      // Extract places from caption using LLM
      if (metadata.caption) {
        const extractedPlaces = await extractPlacesFromText(metadata.caption);
        
        // Save places to database
        const places = await Promise.all(
          extractedPlaces.map(place => 
            storage.createPlace({
              collectionId,
              name: place.name,
              city: place.city,
              country: place.country,
              category: place.category,
              lat: place.lat,
              lng: place.lng,
              confidence: place.confidence,
            })
          )
        );

        res.json({ post, places });
      } else {
        res.json({ post, places: [] });
      }
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePost(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  // Places
  app.get("/api/collections/:collectionId/places", async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const places = await storage.getPlaces(collectionId);
      res.json(places);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ error: "Failed to fetch places" });
    }
  });

  app.delete("/api/places/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlace(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting place:", error);
      res.status(500).json({ error: "Failed to delete place" });
    }
  });

  return httpServer;
}

// Fetch metadata from TikTok or Instagram using oEmbed
async function fetchMetadata(url: string): Promise<{
  source: string;
  thumbnailUrl: string | null;
  caption: string | null;
  author: string | null;
  raw: any;
}> {
  try {
    let oEmbedUrl = "";
    let source = "";

    if (url.includes("tiktok.com")) {
      oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
      source = "tiktok";
    } else if (url.includes("instagram.com")) {
      oEmbedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=YOUR_ACCESS_TOKEN`;
      source = "instagram";
    } else {
      throw new Error("Unsupported URL");
    }

    const response = await fetch(oEmbedUrl);
    if (!response.ok) {
      throw new Error(`oEmbed failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      source,
      thumbnailUrl: data.thumbnail_url || null,
      caption: data.title || null,
      author: data.author_name || data.author_url || null,
      raw: data,
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);
    // Fallback to basic info
    const source = url.includes("tiktok.com") ? "tiktok" : "instagram";
    return {
      source,
      thumbnailUrl: null,
      caption: null,
      author: null,
      raw: {},
    };
  }
}

// Extract places from text using OpenAI
async function extractPlacesFromText(text: string): Promise<Array<{
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  confidence: number;
}>> {
  try {
    const prompt = `Extract all travel locations, landmarks, restaurants, hotels, or places from the following text. For each place, provide:
- name: The name of the place
- city: The city (if mentioned or can be inferred)
- country: The country (if mentioned or can be inferred)
- category: One of: restaurant, hotel, landmark, beach, park, museum, cafe, bar, attraction, other
- confidence: A score from 0 to 1 indicating how confident you are this is a real place

Text: "${text}"

Return your response as a JSON array of objects with keys: name, city, country, category, confidence. If no places are found, return an empty array.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(responseText);
    const places = parsed.places || [];

    // Geocode each place to get coordinates
    const geocodedPlaces = await Promise.all(
      places.map(async (place: any) => {
        const coords = await geocodePlace(place.name, place.city, place.country);
        return {
          ...place,
          lat: coords?.lat || null,
          lng: coords?.lng || null,
        };
      })
    );

    return geocodedPlaces;
  } catch (error) {
    console.error("Error extracting places:", error);
    return [];
  }
}

// Geocode a place name to get coordinates (using a free service or Google Maps)
async function geocodePlace(
  name: string,
  city: string | null,
  country: string | null
): Promise<{ lat: number; lng: number } | null> {
  try {
    // Build search query
    const query = [name, city, country].filter(Boolean).join(", ");
    
    // Using Nominatim (OpenStreetMap) - free geocoding service
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Venturr/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }

    return null;
  } catch (error) {
    console.error("Error geocoding place:", error);
    return null;
  }
}
