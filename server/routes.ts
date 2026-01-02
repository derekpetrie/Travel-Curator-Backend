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

// Valid place categories
const PLACE_CATEGORIES = [
  'restaurant', 'cafe', 'bar', 'nightlife', 'hotel', 'beach', 'attraction',
  'nature', 'park', 'landmark', 'museum', 'shopping', 'activity', 'wellness',
  'neighborhood', 'skiing', 'theme park', 'other'
] as const;

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
      
      // Only generate thumbnail if user didn't provide a cover
      if (!parsed.coverImage && !parsed.coverGradient) {
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
      }
      
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

  // Generate/refresh collection summary
  app.post("/api/collections/:id/summary", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      
      const collection = await storage.getCollection(id, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }

      // Get all places in the collection
      const places = await storage.getPlaces(id);
      
      if (places.length === 0) {
        return res.json({ summary: null, message: "No places to summarize" });
      }

      // Generate a very brief summary
      const placeNames = places.map(p => `${p.name}${p.city ? `, ${p.city}` : ''}${p.country ? ` (${p.country})` : ''}`);
      
      const prompt = `You are a travel guide. Create a VERY brief (max 15 words) itinerary summary for visiting these places: ${placeNames.join('; ')}. Be casual and inspiring. No emojis. Just one short sentence.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
      });

      const summary = response.choices[0]?.message?.content?.trim() || null;
      
      // Save the summary
      await storage.updateCollection(id, userId, { summary });

      res.json({ summary });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
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
      
      // Infer source from URL if metadata failed
      const source = metadata.source || (isTikTok ? "tiktok" : "instagram");
      
      const postData = {
        collectionId,
        source: source as "tiktok" | "instagram",
        url: url,
        thumbnailUrl: metadata.thumbnailUrl || null,
        caption: captionToUse,
        author: metadata.author || null,
        metadataJson: metadata.raw || {},
      };

      const parsed = insertPostSchema.parse(postData);
      const post = await storage.createPost(parsed);
      
      // Update collection's updatedAt timestamp
      await storage.touchCollection(collectionId);

      // Extract places from caption using LLM
      let places: any[] = [];
      let extractedPlaces: any[] = [];
      let extractionMethod: string | null = null;
      let extractionWarning: string | null = null;
      
      // Step 1: Try text extraction from caption
      if (captionToUse) {
        console.log("[Extraction] Starting text extraction with caption:", captionToUse.substring(0, 100) + "...");
        extractedPlaces = await extractPlacesFromText(captionToUse);
        console.log("[Extraction] Text extraction returned", extractedPlaces.length, "places:", extractedPlaces);
        if (extractedPlaces.length > 0) {
          extractionMethod = 'text';
        }
      } else {
        console.log("[Extraction] No caption available for text extraction");
      }
      
      // Step 2: If no places found and we have a thumbnail, try vision extraction
      if (extractedPlaces.length === 0 && metadata.thumbnailUrl) {
        console.log("[Extraction] No places from text, trying vision fallback...");
        extractedPlaces = await extractPlacesFromImage(metadata.thumbnailUrl);
        if (extractedPlaces.length > 0) {
          extractionMethod = 'vision';
        }
      }
      
      // Step 3: If still no places, set warning message
      if (extractedPlaces.length === 0) {
        extractionWarning = "We couldn't identify specific locations from this post. The description and image didn't contain enough location details for us to extract places.";
        console.log("[Extraction] No places found from text or vision");
      }
      
      // Save places to database
      if (extractedPlaces.length > 0) {
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
        
        // Regenerate summary in the background when new places are extracted
        const userId = getUserId(req);
        // Fire-and-forget summary regeneration
        (async () => {
          try {
            const allPlaces = await storage.getPlaces(collectionId);
            if (allPlaces.length > 0) {
              const placeNames = allPlaces.map(p => `${p.name}${p.city ? `, ${p.city}` : ''}${p.country ? ` (${p.country})` : ''}`);
              const prompt = `You are a travel guide. Create a VERY brief (max 15 words) itinerary summary for visiting these places: ${placeNames.join('; ')}. Be casual and inspiring. No emojis. Just one short sentence.`;
              const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 50,
              });
              const summary = response.choices[0]?.message?.content?.trim() || null;
              await storage.updateCollection(collectionId, userId, { summary });
            }
          } catch (err) {
            console.error("Error regenerating summary:", err);
          }
        })();
      }

      res.json({ post, places, extractionMethod, extractionWarning });
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
  
  // Get all places for the user (across all collections)
  app.get("/api/places", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const places = await storage.getPlacesByUser(userId);
      res.json(places);
    } catch (error) {
      console.error("Error fetching all places:", error);
      res.status(500).json({ error: "Failed to fetch places" });
    }
  });

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
      const userId = getUserId(req);
      
      // Get the place to find its collection before deleting
      const place = await storage.getPlace(id);
      if (place) {
        // Clear summary so it regenerates
        await storage.updateCollection(place.collectionId, userId, { summary: null });
      }
      
      await storage.deletePlace(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting place:", error);
      res.status(500).json({ error: "Failed to delete place" });
    }
  });

  // Update place category
  app.patch("/api/places/:id/category", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const { category } = req.body;
      
      // Validate category
      if (!category || !PLACE_CATEGORIES.includes(category.toLowerCase())) {
        return res.status(400).json({ 
          error: "Invalid category", 
          validCategories: PLACE_CATEGORIES 
        });
      }
      
      // Get the place to verify ownership through collection
      const place = await storage.getPlace(id);
      if (!place) {
        return res.status(404).json({ error: "Place not found" });
      }
      
      // Verify the place belongs to a collection owned by this user
      const collection = await storage.getCollection(place.collectionId, userId);
      if (!collection) {
        return res.status(403).json({ error: "Not authorized to modify this place" });
      }
      
      await storage.updatePlaceCategory(id, category.toLowerCase());
      
      res.json({ success: true, category: category.toLowerCase() });
    } catch (error) {
      console.error("Error updating place category:", error);
      res.status(500).json({ error: "Failed to update place category" });
    }
  });

  return httpServer;
}

// Fetch metadata from TikTok or Instagram using Iframely API
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
    return await fetchIframelyMetadata(url, source);
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

// Fetch metadata using Iframely API (works for both TikTok and Instagram)
async function fetchIframelyMetadata(url: string, source: string): Promise<{
  source: string;
  thumbnailUrl: string | null;
  caption: string | null;
  author: string | null;
  raw: any;
  error?: string;
}> {
  const apiKey = process.env.IFRAMELY_API_KEY;

  if (!apiKey) {
    console.warn("[Iframely] API key not configured");
    return {
      source,
      thumbnailUrl: null,
      caption: null,
      author: null,
      raw: {},
      error: "Iframely integration not configured. Please add IFRAMELY_API_KEY.",
    };
  }

  const iframelyUrl = `https://iframe.ly/api/oembed?url=${encodeURIComponent(url)}&api_key=${apiKey}`;
  
  console.log(`[Iframely] Fetching ${source} metadata...`);

  const response = await fetch(iframelyUrl, {
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`[Iframely] Failed (${response.status}):`, errorData);
    throw new Error(`Iframely API failed: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[Iframely] ${source} metadata fetched successfully:`, {
    title: data.title?.substring(0, 50),
    author: data.author_name,
    hasThumbnail: !!data.thumbnail_url,
  });

  return {
    source,
    thumbnailUrl: data.thumbnail_url || null,
    caption: data.title || null,
    author: data.author_name || null,
    raw: data,
  };
}

// Extract places from image using GPT-4o vision
async function extractPlacesFromImage(imageUrl: string): Promise<Array<{
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  confidence: number;
}>> {
  try {
    console.log("[Vision] Analyzing thumbnail for places:", imageUrl);
    
    const prompt = `Analyze this travel image and identify any SPECIFIC, VISITABLE places shown or indicated.

IMPORTANT RULES:
1. Look for text overlays, location labels, or recognizable landmarks in the image
2. Only identify places you can name specifically (not just "a temple" but "Senso-ji Temple")
3. If you see famous landmarks, identify them by name
4. If there's text showing location names, extract those
5. Do NOT guess generic places - only identify what you can specifically recognize or read

For each place you can identify, provide:
- name: The specific venue/landmark name
- city: The city (if you can determine it)
- country: The country (if you can determine it)
- category: One of: restaurant, cafe, bar, hotel, beach, attraction, nature, park, landmark, museum, shopping, activity, wellness, neighborhood, sports, entertainment, other
- confidence: A score from 0 to 1 (use 0.7+ only for places you're certain about)

Return your response as JSON with a "places" array. If you cannot identify any specific places, return {"places": []}.
Do NOT make up places or guess - only return places you can specifically identify from the image.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    console.log("[Vision] Raw response:", responseText);
    
    const parsed = JSON.parse(responseText);
    const places = parsed.places || [];
    
    console.log(`[Vision] Found ${places.length} places from image analysis`);

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
    console.error("[Vision] Error extracting places from image:", error);
    return [];
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
    const prompt = `Extract all VISITABLE travel destinations from the following text. The experience/activity matters as much as the location.

IMPORTANT RULES:
1. Extract the ACTUAL VENUE, not team/brand names. For sports teams, extract their stadium/arena with the experience:
   - "Chelsea FC match" → name: "Stamford Bridge - Chelsea FC Match", category: "sports"
   - "Lakers game" → name: "Crypto.com Arena - Lakers Game", category: "sports"
   - "Manchester United" → name: "Old Trafford - Manchester United Match", category: "sports"
2. Include the ACTIVITY in the name when it's the main draw (e.g., "Borough Market - Food Tour", "Thames - River Cruise")
3. Only extract places someone can physically visit - skip abstract concepts, brands, or online services
4. When uncertain if something is a real visitable place, set confidence below 0.5

For each place, provide:
- name: The venue name, optionally with the activity/experience (e.g., "Stamford Bridge - Chelsea FC Match")
- city: The city or region. IMPORTANT: For US locations, you MUST include the state name (e.g., "Summit County, Colorado" or "Austin, Texas" - NEVER just "Summit County" or "Austin")
- country: The country (if mentioned or can be inferred)
- category: One of: restaurant, cafe, bar, nightlife, hotel, beach, attraction, nature, park, landmark, museum, shopping, activity, wellness, neighborhood, skiing, theme park, sports, entertainment, other
- confidence: A score from 0 to 1 indicating how confident you are this is a real visitable place

Category guidance:
- Use "sports" for stadiums, arenas, and sporting events
- Use "entertainment" for concerts, shows, theaters, comedy clubs
- Use "attraction" for developed tourist sites with paid admission (caves, observation decks, aquariums, zoos)
- Use "nature" for natural outdoor areas (forests, trails, lakes, mountains)
- Use "landmark" for iconic recognizable structures or monuments
- Use "activity" for experiences like tours, classes, or adventure activities

Text: "${text}"

Return your response as a JSON array of objects with keys: name, city, country, category, confidence. If no places are found, return an empty array.`;

    console.log("[Text Extraction] Calling OpenAI with caption length:", text.length);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    console.log("[Text Extraction] OpenAI response:", responseText.substring(0, 300));
    const parsed = JSON.parse(responseText);
    // Handle various response formats from OpenAI
    const places = parsed.places || parsed.result || parsed.results || (Array.isArray(parsed) ? parsed : []);
    console.log("[Text Extraction] Parsed places:", places.length);

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
  // Strip common suffixes that OSM might not use
  const suffixes = [' - Ski Resort', ' - Restaurant', ' - Hotel', ' - Cafe', ' - Bar', ' - Museum'];
  let cleanName = name;
  for (const suffix of suffixes) {
    if (name.includes(suffix)) {
      cleanName = name.replace(suffix, '');
      break;
    }
  }
  
  // Strip common prefixes that OSM might not use
  const prefixes = ['Lake ', 'Mount ', 'Mt. ', 'Mt ', 'Beach ', 'Castle ', 'Temple ', 'Shrine ', 'The ', 'Restaurant ', 'Cafe ', 'Hotel '];
  let strippedName = cleanName;
  for (const prefix of prefixes) {
    if (cleanName.startsWith(prefix)) {
      strippedName = cleanName.slice(prefix.length);
      break;
    }
  }

  // Helper to check if result matches expected location
  const resultMatchesLocation = (displayName: string): boolean => {
    const lowerDisplay = displayName.toLowerCase();
    // For US locations with city containing state, check state match
    if (city && city.includes(',')) {
      const parts = city.split(',').map(p => p.trim().toLowerCase());
      // Check if any part matches
      if (!parts.some(part => lowerDisplay.includes(part))) {
        return false;
      }
    } else if (city && !lowerDisplay.includes(city.toLowerCase())) {
      return false;
    }
    // Must match country if provided
    if (country && !lowerDisplay.includes(country.toLowerCase())) {
      // Also check common country abbreviations
      const countryAbbrevs: Record<string, string[]> = {
        'united kingdom': ['uk', 'england', 'scotland', 'wales', 'britain'],
        'united states': ['usa', 'us', 'america'],
        'united arab emirates': ['uae'],
      };
      const abbrevs = countryAbbrevs[country.toLowerCase()] || [];
      if (!abbrevs.some(abbrev => lowerDisplay.includes(abbrev))) {
        return false;
      }
    }
    return true;
  };

  const queries = [
    // Try the clean name with full location context first
    [cleanName, city, country].filter(Boolean).join(", "),
    // Full queries with location context
    [name, city, country].filter(Boolean).join(", "),
    [strippedName, city, country].filter(Boolean).join(", "),
    // Try just the clean name with country (for famous landmarks)
    [cleanName, country].filter(Boolean).join(", "),
    [strippedName, country].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];

  // Remove duplicates
  const uniqueQueries = Array.from(new Set(queries));

  for (const query of uniqueQueries) {
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Use limit=5 to get multiple results we can filter
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Venturr/1.0 (travel-collection-app)",
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      // Find the first result that matches our expected location
      for (const result of data) {
        if (resultMatchesLocation(result.display_name)) {
          console.log(`[Geocoding] Found "${name}" with query: "${query}" -> ${result.lat}, ${result.lon} (${result.display_name})`);
          return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          };
        }
      }
      
      // If no results matched the location, log it
      if (data.length > 0) {
        console.log(`[Geocoding] Found ${data.length} results for "${query}" but none matched expected location (city: ${city}, country: ${country})`);
      }
    } catch (error) {
      console.error(`[Geocoding] Error with query "${query}":`, error);
    }
  }

  // Fallback: Try geocoding just the city if we have one
  if (city && country) {
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      const cityQuery = `${city}, ${country}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityQuery)}&format=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Venturr/1.0 (travel-collection-app)",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          console.log(`[Geocoding] Falling back to city center for "${name}": ${city}, ${country} -> ${data[0].lat}, ${data[0].lon}`);
          return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
        }
      }
    } catch (error) {
      console.error(`[Geocoding] City fallback error:`, error);
    }
  }

  console.log(`[Geocoding] Could not find coordinates for "${name}" after trying ${uniqueQueries.length} queries`);
  return null;
}

// Recategorize a single place using AI
async function recategorizePlace(
  name: string,
  city: string | null,
  country: string | null
): Promise<string | null> {
  try {
    const locationInfo = [name, city, country].filter(Boolean).join(", ");
    
    const prompt = `Categorize this travel place into exactly one of these categories: ${PLACE_CATEGORIES.join(', ')}.

Category guidance:
- Use "attraction" for developed tourist sites with paid admission or guided tours (caves, observation decks, aquariums, zoos, etc.)
- Use "nature" for natural outdoor areas without significant development
- Use "landmark" for iconic recognizable structures or monuments
- Use "activity" for experiences like tours, classes, or adventure activities

Place: ${locationInfo}

Return ONLY the category name, nothing else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 20,
      temperature: 0.2,
    });

    const category = response.choices[0]?.message?.content?.trim().toLowerCase() || null;
    return category;
  } catch (error) {
    console.error(`[Recategorize] Error for "${name}":`, error);
    return null;
  }
}
