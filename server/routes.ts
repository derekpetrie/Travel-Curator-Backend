import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCollectionSchema, insertPostSchema, insertPlaceSchema } from "@shared/schema";
import { OpenAI } from "openai";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { generateCollectionThumbnail } from "./lib/thumbnail";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

const objectStorageService = new ObjectStorageService();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Helper to get userId from request
function getUserId(req: Request): string {
  return (req.user as any)?.claims?.sub;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication FIRST
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app);
  
  // Collections - protected routes
  app.get("/api/collections", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const collections = await storage.getCollections(userId);
      res.json(collections);
    } catch (error) {
      console.error("Error fetching collections:", error);
      res.status(500).json({ error: "Failed to fetch collections" });
    }
  });

  app.get("/api/collections/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const collection = await storage.getCollection(id, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      res.json(collection);
    } catch (error) {
      console.error("Error fetching collection:", error);
      res.status(500).json({ error: "Failed to fetch collection" });
    }
  });

  app.post("/api/collections", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertCollectionSchema.parse({ ...req.body, userId });
      const collection = await storage.createCollection(parsed);
      
      // Generate thumbnail in the background (don't block response)
      generateCollectionThumbnail(parsed.title).then(async (thumbnail) => {
        try {
          await storage.updateCollectionThumbnail(
            collection.id,
            userId,
            thumbnail.coverImage,
            thumbnail.coverGradient
          );
        } catch (err) {
          console.error("Error updating collection thumbnail:", err);
        }
      });
      
      res.json(collection);
    } catch (error) {
      console.error("Error creating collection:", error);
      res.status(400).json({ error: "Invalid collection data" });
    }
  });

  app.patch("/api/collections/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const { title } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }

      // Update the collection title immediately
      const collection = await storage.updateCollection(id, userId, { 
        title: title.trim(),
        coverImage: null,
        coverGradient: null 
      });

      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }

      // Regenerate thumbnail in the background
      generateCollectionThumbnail(title.trim()).then(async (thumbnail) => {
        try {
          await storage.updateCollectionThumbnail(
            id,
            userId,
            thumbnail.coverImage,
            thumbnail.coverGradient
          );
          console.log(`[Thumbnail] Updated thumbnail for renamed collection: ${title}`);
        } catch (err) {
          console.error("Error updating collection thumbnail after rename:", err);
        }
      });

      res.json(collection);
    } catch (error) {
      console.error("Error renaming collection:", error);
      res.status(500).json({ error: "Failed to rename collection" });
    }
  });

  // Update collection cover (custom image or gradient)
  app.patch("/api/collections/:id/cover", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const { coverImage, coverGradient } = req.body;

      // Get current collection to verify ownership
      const existingCollection = await storage.getCollection(id, userId);
      if (!existingCollection) {
        return res.status(404).json({ error: "Collection not found" });
      }

      // If coverImage is from object storage, normalize and set ACL
      let normalizedCoverImage = coverImage;
      if (coverImage && coverImage.startsWith("https://storage.googleapis.com/")) {
        normalizedCoverImage = await objectStorageService.trySetObjectEntityAclPolicy(
          coverImage,
          { owner: userId, visibility: "public" }
        );
      }

      // Update the cover
      await storage.updateCollectionThumbnail(id, userId, normalizedCoverImage, coverGradient);

      const updatedCollection = await storage.getCollection(id, userId);
      res.json(updatedCollection);
    } catch (error) {
      console.error("Error updating collection cover:", error);
      res.status(500).json({ error: "Failed to update collection cover" });
    }
  });

  app.delete("/api/collections/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      await storage.deleteCollection(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting collection:", error);
      res.status(500).json({ error: "Failed to delete collection" });
    }
  });

  // Posts - protected routes
  app.get("/api/collections/:collectionId/posts", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const userId = getUserId(req);
      // Verify collection belongs to user
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      const posts = await storage.getPosts(collectionId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/collections/:collectionId/posts", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const { url, manualCaption } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Validate URL is from a supported platform
      const isTikTok = url.includes("tiktok.com");
      const isInstagram = url.includes("instagram.com");
      
      if (!isTikTok && !isInstagram) {
        return res.status(400).json({ 
          error: "Unsupported URL. Please use TikTok or Instagram links." 
        });
      }

      // Fetch metadata using oEmbed
      const metadata = await fetchMetadata(url);
      
      // If metadata fetch failed and no manual caption provided, return error
      if (metadata.error && !manualCaption) {
        return res.status(400).json({ 
          error: metadata.error,
          needsManualCaption: true,
        });
      }
      
      // Use manual caption if provided (fallback when oEmbed fails)
      const captionToUse = metadata.caption || manualCaption || null;
      
      const postData = {
        collectionId,
        source: metadata.source as "tiktok" | "instagram",
        url: url,
        thumbnailUrl: metadata.thumbnailUrl,
        caption: captionToUse,
        author: metadata.author,
        metadataJson: metadata.raw,
      };

      const parsed = insertPostSchema.parse(postData);
      const post = await storage.createPost(parsed);

      // Extract places from caption using LLM
      let places: any[] = [];
      if (captionToUse) {
        const extractedPlaces = await extractPlacesFromText(captionToUse);
        
        // Save places to database
        places = await Promise.all(
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
      }

      res.json({ post, places });
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.delete("/api/posts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePost(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  // Places - protected routes
  app.get("/api/collections/:collectionId/places", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.collectionId);
      const userId = getUserId(req);
      // Verify collection belongs to user
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      const places = await storage.getPlaces(collectionId);
      res.json(places);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ error: "Failed to fetch places" });
    }
  });

  app.delete("/api/places/:id", isAuthenticated, async (req, res) => {
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
  error?: string;
}> {
  const source = url.includes("tiktok.com") ? "tiktok" : 
                 url.includes("instagram.com") ? "instagram" : "unknown";

  if (source === "unknown") {
    return {
      source: "unknown",
      thumbnailUrl: null,
      caption: null,
      author: null,
      raw: {},
      error: "Unsupported URL. Please use TikTok or Instagram links.",
    };
  }

  try {
    if (source === "tiktok") {
      return await fetchTikTokMetadata(url);
    } else {
      return await fetchInstagramMetadata(url);
    }
  } catch (error) {
    console.error(`Error fetching ${source} metadata:`, error);
    return {
      source,
      thumbnailUrl: null,
      caption: null,
      author: null,
      raw: {},
      error: `Failed to fetch metadata from ${source}. The post may be private or unavailable.`,
    };
  }
}

// Fetch TikTok metadata using their public oEmbed API
async function fetchTikTokMetadata(url: string): Promise<{
  source: string;
  thumbnailUrl: string | null;
  caption: string | null;
  author: string | null;
  raw: any;
  error?: string;
}> {
  const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  
  console.log("[oEmbed] Fetching TikTok metadata...");
  
  const response = await fetch(oEmbedUrl, {
    headers: {
      "User-Agent": "Venturr/1.0",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`[oEmbed] TikTok failed (${response.status}):`, errorText);
    throw new Error(`TikTok oEmbed failed: ${response.status}`);
  }

  const data = await response.json();
  console.log("[oEmbed] TikTok metadata fetched successfully:", {
    title: data.title?.substring(0, 50),
    author: data.author_name,
    hasThumbnail: !!data.thumbnail_url,
  });

  return {
    source: "tiktok",
    thumbnailUrl: data.thumbnail_url || null,
    caption: data.title || null,
    author: data.author_name || null,
    raw: data,
  };
}

// Fetch Instagram metadata using Meta's Graph API oEmbed
async function fetchInstagramMetadata(url: string): Promise<{
  source: string;
  thumbnailUrl: string | null;
  caption: string | null;
  author: string | null;
  raw: any;
  error?: string;
}> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;

  if (!appId || !appSecret) {
    console.warn("[oEmbed] Instagram credentials not configured");
    return {
      source: "instagram",
      thumbnailUrl: null,
      caption: null,
      author: null,
      raw: {},
      error: "Instagram integration not configured. Please add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET.",
    };
  }

  const accessToken = `${appId}|${appSecret}`;
  const oEmbedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${accessToken}`;
  
  console.log("[oEmbed] Fetching Instagram metadata...");

  const response = await fetch(oEmbedUrl, {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[oEmbed] Instagram failed (${response.status}):`, errorData);
    
    if (response.status === 400 && errorData.error?.message?.includes("Invalid access token")) {
      throw new Error("Invalid Instagram credentials. Please check your app configuration.");
    }
    
    throw new Error(`Instagram oEmbed failed: ${response.status}`);
  }

  const data = await response.json();
  console.log("[oEmbed] Instagram metadata fetched successfully:", {
    title: data.title?.substring(0, 50),
    author: data.author_name,
    hasThumbnail: !!data.thumbnail_url,
  });

  return {
    source: "instagram",
    thumbnailUrl: data.thumbnail_url || null,
    caption: data.title || null,
    author: data.author_name || null,
    raw: data,
  };
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

async function geocodePlace(
  name: string,
  city: string | null,
  country: string | null
): Promise<{ lat: number; lng: number } | null> {
  // Strip common prefixes that OSM might not use
  const prefixes = ['Lake ', 'Mount ', 'Mt. ', 'Mt ', 'Beach ', 'Castle ', 'Temple ', 'Shrine ', 'The ', 'Restaurant ', 'Cafe ', 'Hotel '];
  let strippedName = name;
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      strippedName = name.slice(prefix.length);
      break;
    }
  }

  const queries = [
    // Full queries with location context
    [name, city, country].filter(Boolean).join(", "),
    [name, country].filter(Boolean).join(", "),
    [strippedName, country].filter(Boolean).join(", "),
    // Just the name variations
    name,
    strippedName,
    // Try with country in different format
    country ? `${name} ${country}` : null,
    country ? `${strippedName} ${country}` : null,
  ].filter(Boolean) as string[];

  // Remove duplicates
  const uniqueQueries = Array.from(new Set(queries));

  for (const query of uniqueQueries) {
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Venturr/1.0 (travel-collection-app)",
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      if (data.length > 0) {
        console.log(`[Geocoding] Found "${name}" with query: "${query}" -> ${data[0].lat}, ${data[0].lon}`);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.error(`[Geocoding] Error with query "${query}":`, error);
    }
  }

  console.log(`[Geocoding] Could not find coordinates for "${name}" after trying ${uniqueQueries.length} queries`);
  return null;
}
