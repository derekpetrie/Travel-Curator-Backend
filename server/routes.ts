import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertCollectionSchema, insertPostSchema, insertPlaceSchema, planContentSchema, collections } from "@shared/schema";
import type { VenturrPlace, PlanContent, PlaceWithEnrichment } from "@shared/schema";
import { eq } from "drizzle-orm";
import { OpenAI } from "openai";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { generateCollectionThumbnail } from "./lib/thumbnail";
import { matchOrCreateVenturrPlace } from "./lib/place-matching";
import { enrichPlaceAsync } from "./lib/foursquare";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { calculateTravelTimeMatrix, formatDuration, TIME_BLOCK_BUDGETS } from "./duration-estimator";
import { buildPhotoUrl, isGooglePhotoReference } from "./lib/google-places";

const objectStorageService = new ObjectStorageService();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Valid place categories (simplified to 3)
const PLACE_CATEGORIES = [
  'things to do',
  'places to eat', 
  'places to stay'
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
  
  // Photo proxy endpoint - public for performance (images don't need auth)
  // Uses 302 redirect to avoid proxying bandwidth through our server
  app.get("/api/photos/:encodedRef", (req, res) => {
    try {
      const { encodedRef } = req.params;
      const widthParam = req.query.width;
      
      // Decode base64url to get the photo reference
      const photoRef = Buffer.from(encodedRef, 'base64url').toString('utf-8');
      
      // Validate it's a Google Places photo reference
      if (!isGooglePhotoReference(photoRef)) {
        return res.status(400).json({ error: "Invalid photo reference" });
      }
      
      // Clamp width to reasonable bounds (100-800px)
      let width = 400;
      if (widthParam) {
        const parsed = parseInt(widthParam as string, 10);
        if (!isNaN(parsed)) {
          width = Math.max(100, Math.min(800, parsed));
        }
      }
      
      // Generate fresh signed URL
      const signedUrl = buildPhotoUrl(photoRef, width);
      
      // Set cache headers (1 day client, 30 days CDN)
      res.set({
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
        'Surrogate-Control': 'max-age=2592000',
      });
      
      // Redirect to the signed URL
      res.redirect(302, signedUrl);
    } catch (error) {
      console.error("[Photo Proxy] Error:", error);
      res.status(500).json({ error: "Failed to generate photo URL" });
    }
  });
  
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

      // Update only the title, preserve gradient
      const collection = await storage.updateCollection(id, userId, { 
        title: title.trim()
      });

      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }

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
      const userId = getUserId(req);
      const { url, manualCaption } = req.body;

      // Verify collection belongs to user
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }

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

      // Check for duplicate URL in this collection
      const urlExists = await storage.postExistsInCollection(collectionId, url);
      if (urlExists) {
        return res.status(400).json({ 
          error: "This link has already been saved to this Venturr.",
          isDuplicate: true
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
        userId: getUserId(req),
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
        extractionWarning = "NO_PLACES_FOUND";
        console.log("[Extraction] No places found from text or vision");
      }
      
      // Save places to database using new canonical VenturrPlace system
      let venturrPlaces: VenturrPlace[] = [];
      if (extractedPlaces.length > 0) {
        // For each extracted place, match to existing VenturrPlace or create new
        for (const extractedPlace of extractedPlaces) {
          try {
            const { place: venturrPlace, isNew, matchType } = await matchOrCreateVenturrPlace({
              name: extractedPlace.name,
              city: extractedPlace.city,
              country: extractedPlace.country,
              category: extractedPlace.category || 'things to do',
              lat: extractedPlace.lat,
              lng: extractedPlace.lng,
              confidence: extractedPlace.confidence,
            });

            // Create PostPlaceLink to connect the post to this place
            await storage.createPostPlaceLink({
              postId: post.id,
              placeId: venturrPlace.id,
              confidence: extractedPlace.confidence,
              linkType: 'extracted',
            });

            venturrPlaces.push(venturrPlace);
            console.log(`[Extraction] Linked post ${post.id} to VenturrPlace ${venturrPlace.id} (${isNew ? 'new' : matchType})`);
            
            // Trigger async enrichment (fire and forget - won't block response)
            enrichPlaceAsync(venturrPlace.id);
          } catch (err) {
            console.error(`[Extraction] Error matching/creating place "${extractedPlace.name}":`, err);
          }
        }

        // Also save to legacy places table for backward compatibility during migration
        places = await Promise.all(
          extractedPlaces.map(place => 
            storage.createPlace({
              userId: getUserId(req),
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

  // Re-extract places for an existing post (for debugging/retry)
  app.post("/api/posts/:id/re-extract", isAuthenticated, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      // Get the post
      const post = await storage.getPost(postId);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }
      
      // Verify the post belongs to the user (via userId on post)
      if (post.userId !== userId) {
        return res.status(403).json({ error: "Not authorized" });
      }
      
      // Check if collection still exists (optional, only for logging)
      const collection = post.collectionId ? await storage.getCollection(post.collectionId, userId) : null;
      
      console.log(`[Re-Extract] Starting extraction for post ${postId}`);
      console.log(`[Re-Extract] Caption: ${post.caption?.substring(0, 100)}...`);
      console.log(`[Re-Extract] Thumbnail: ${post.thumbnailUrl ? 'present' : 'missing'}`);
      
      let extractedPlaces: any[] = [];
      let extractionMethod: string | null = null;
      
      // Step 1: Try text extraction from caption
      if (post.caption) {
        console.log("[Re-Extract] Trying text extraction...");
        extractedPlaces = await extractPlacesFromText(post.caption);
        console.log("[Re-Extract] Text extraction returned", extractedPlaces.length, "places");
        if (extractedPlaces.length > 0) {
          extractionMethod = 'text';
        }
      }
      
      // Step 2: If no places found and we have a thumbnail, try vision extraction
      if (extractedPlaces.length === 0 && post.thumbnailUrl) {
        console.log("[Re-Extract] No places from text, trying vision...");
        extractedPlaces = await extractPlacesFromImage(post.thumbnailUrl);
        console.log("[Re-Extract] Vision extraction returned", extractedPlaces.length, "places");
        if (extractedPlaces.length > 0) {
          extractionMethod = 'vision';
        }
      }
      
      // Save places to database
      const venturrPlaces: VenturrPlace[] = [];
      for (const extractedPlace of extractedPlaces) {
        try {
          const { place: venturrPlace, isNew, matchType } = await matchOrCreateVenturrPlace({
            name: extractedPlace.name,
            city: extractedPlace.city,
            country: extractedPlace.country,
            category: extractedPlace.category || 'things to do',
            lat: extractedPlace.lat,
            lng: extractedPlace.lng,
            confidence: extractedPlace.confidence,
          });

          // Create PostPlaceLink
          await storage.createPostPlaceLink({
            postId: post.id,
            placeId: venturrPlace.id,
            confidence: extractedPlace.confidence,
            linkType: 'extracted',
          });

          venturrPlaces.push(venturrPlace);
          console.log(`[Re-Extract] Linked post ${post.id} to VenturrPlace ${venturrPlace.id}`);
          
          // Trigger enrichment
          enrichPlaceAsync(venturrPlace.id);
        } catch (err) {
          console.error(`[Re-Extract] Error matching/creating place:`, err);
        }
      }
      
      res.json({ 
        success: true,
        extractionMethod,
        extractedPlaces,
        venturrPlaces: venturrPlaces.map(p => ({ id: p.id, name: p.name }))
      });
    } catch (error) {
      console.error("Error re-extracting places:", error);
      res.status(500).json({ error: "Failed to re-extract places" });
    }
  });

  // Places - protected routes
  
  // Get all places for the user (across all collections) - uses new VenturrPlace system
  app.get("/api/places", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      // Use new VenturrPlace system via PostPlaceLinks
      const venturrPlaces = await storage.getPlacesForUser(userId);
      
      // Transform to legacy Place format for frontend compatibility
      const places = venturrPlaces.map(vp => ({
        id: vp.linkId, // Use link ID so delete works correctly
        collectionId: vp.collectionId,
        name: vp.name,
        city: vp.city,
        country: vp.country,
        category: vp.categoryPrimary,
        lat: vp.lat,
        lng: vp.lng,
        confidence: null,
        createdAt: vp.createdAt,
        // Include VenturrPlace ID and enrichment data
        venturrPlaceId: vp.id,
        fsqId: vp.fsqId,
        fsqData: vp.fsqData,
        enrichmentStatus: vp.enrichmentStatus,
        // Flattened Foursquare fields
        photoUrl: vp.photoUrl,
        rating: vp.rating,
        website: vp.website,
        phone: vp.phone,
        hoursDisplay: vp.hoursDisplay,
        isOpenNow: vp.isOpenNow,
        priceLevel: vp.priceLevel,
        addressFull: vp.addressFull,
        // Source post info for discovery attribution
        sourcePostUrl: vp.sourcePostUrl,
        sourcePostSource: vp.sourcePostSource,
      }));
      
      res.json(places);
    } catch (error) {
      console.error("Error fetching all places:", error);
      res.status(500).json({ error: "Failed to fetch places" });
    }
  });

  // Get which collections contain a specific place
  app.get("/api/places/:id/collections", isAuthenticated, async (req, res) => {
    try {
      const placeId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      if (isNaN(placeId)) {
        return res.status(400).json({ error: "Invalid place ID" });
      }
      
      const collections = await storage.getCollectionsForPlace(placeId, userId);
      res.json(collections);
    } catch (error) {
      console.error("Error fetching collections for place:", error);
      res.status(500).json({ error: "Failed to fetch collections for place" });
    }
  });

  // Copy places to a collection (with their associated posts)
  app.post("/api/collections/:id/copy-places", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const userId = getUserId(req);
      const { placeIds } = req.body;
      
      if (!Array.isArray(placeIds) || placeIds.length === 0) {
        return res.status(400).json({ error: "placeIds must be a non-empty array" });
      }
      
      const numericPlaceIds = placeIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      
      const result = await storage.copyPlacesToCollection(numericPlaceIds, collectionId, userId);
      res.json(result);
    } catch (error) {
      console.error("Error copying places:", error);
      const message = error instanceof Error ? error.message : "Failed to copy places";
      res.status(500).json({ error: message });
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
      
      // Use new VenturrPlace system via PostPlaceLinks
      const venturrPlaces = await storage.getPlacesForCollection(collectionId);
      
      // Transform to legacy Place format for frontend compatibility
      const places = venturrPlaces.map(vp => ({
        id: vp.linkId, // Use link ID so delete works correctly
        collectionId: collectionId,
        name: vp.name,
        city: vp.city,
        country: vp.country,
        category: vp.categoryPrimary,
        lat: vp.lat,
        lng: vp.lng,
        confidence: vp.confidence,
        createdAt: vp.createdAt,
        // Include VenturrPlace ID and enrichment data
        venturrPlaceId: vp.id,
        fsqId: vp.fsqId,
        fsqData: vp.fsqData,
        enrichmentStatus: vp.enrichmentStatus,
        // Flattened Foursquare fields
        photoUrl: vp.photoUrl,
        rating: vp.rating,
        website: vp.website,
        phone: vp.phone,
        hoursDisplay: vp.hoursDisplay,
        isOpenNow: vp.isOpenNow,
        priceLevel: vp.priceLevel,
        addressFull: vp.addressFull,
      }));
      
      res.json(places);
    } catch (error) {
      console.error("Error fetching places:", error);
      res.status(500).json({ error: "Failed to fetch places" });
    }
  });

  // Delete a place link (removes the place from user's collection, doesn't delete the canonical VenturrPlace)
  app.delete("/api/places/:id", isAuthenticated, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      // Verify ownership before deleting
      const linkWithOwnership = await storage.getPostPlaceLinkWithOwnership(linkId, userId);
      if (!linkWithOwnership) {
        return res.status(404).json({ error: "Place not found or not authorized" });
      }
      
      // Delete the PostPlaceLink
      await storage.deletePostPlaceLink(linkId);
      
      // Also delete legacy place if it exists (for backward compatibility)
      // This will be removed once migration is complete
      try {
        await storage.deletePlace(linkId);
      } catch (e) {
        // Ignore if legacy place doesn't exist
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting place:", error);
      res.status(500).json({ error: "Failed to delete place" });
    }
  });

  // Update place category (uses linkId from frontend, updates VenturrPlace.categoryPrimary)
  app.patch("/api/places/:id/category", isAuthenticated, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const userId = getUserId(req);
      const { category } = req.body;
      
      // Validate category
      if (!category || !PLACE_CATEGORIES.includes(category.toLowerCase())) {
        return res.status(400).json({ 
          error: "Invalid category", 
          validCategories: PLACE_CATEGORIES 
        });
      }
      
      // Get the PostPlaceLink to find the VenturrPlace and verify ownership
      const linkWithOwnership = await storage.getPostPlaceLinkWithOwnership(linkId, userId);
      if (!linkWithOwnership) {
        return res.status(404).json({ error: "Place not found or not authorized" });
      }
      
      // Update the VenturrPlace's categoryPrimary
      await storage.updateVenturrPlace(linkWithOwnership.link.placeId, {
        categoryPrimary: category.toLowerCase()
      });
      
      // Also update legacy place for backward compatibility
      try {
        await storage.updatePlaceCategory(linkId, category.toLowerCase());
      } catch (e) {
        // Ignore if legacy place doesn't exist
      }
      
      res.json({ success: true, category: category.toLowerCase() });
    } catch (error) {
      console.error("Error updating place category:", error);
      res.status(500).json({ error: "Failed to update place category" });
    }
  });

  // Re-enrich a place (retry Foursquare + Google Places)
  app.post("/api/places/:id/enrich", isAuthenticated, async (req, res) => {
    try {
      const linkId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      // Verify ownership
      const linkWithOwnership = await storage.getPostPlaceLinkWithOwnership(linkId, userId);
      if (!linkWithOwnership) {
        return res.status(404).json({ error: "Place not found or not authorized" });
      }
      
      const venturrPlaceId = linkWithOwnership.link.placeId;
      
      // Reset enrichment status and try again
      await storage.updateVenturrPlace(venturrPlaceId, {
        enrichmentStatus: 'pending',
        fsqId: null,
        fsqData: null,
        fsqFetchedAt: null,
        googlePlaceId: null,
        googleData: null,
        googleFetchedAt: null,
      });
      
      // Trigger async enrichment (Foursquare first, then Google fallback)
      enrichPlaceAsync(venturrPlaceId);
      
      res.json({ success: true, message: "Enrichment started" });
    } catch (error) {
      console.error("Error re-enriching place:", error);
      res.status(500).json({ error: "Failed to re-enrich place" });
    }
  });

  // ========== PLAN ROUTES ==========

  // Get plan for a collection
  app.get("/api/collections/:id/plan", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      // Verify user owns this collection
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      const plan = await storage.getPlanByCollection(collectionId);
      
      // Get current places snapshot hash to detect staleness (use venturrPlaces via getPlacesForCollection)
      const places = await storage.getPlacesForCollection(collectionId);
      const currentHash = generatePlacesSnapshotHash(places);
      
      res.json({
        plan: plan || null,
        isStale: plan?.placesSnapshotHash !== currentHash && plan?.status === 'ready',
        currentPlacesHash: currentHash,
      });
    } catch (error) {
      console.error("Error fetching plan:", error);
      res.status(500).json({ error: "Failed to fetch plan" });
    }
  });

  // Generate or regenerate a plan
  app.post("/api/collections/:id/plan/generate", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const userId = getUserId(req);
      const { 
        durationDays = 3, 
        peopleCount = "2", 
        tripPurpose = "friends_outing",
        includeRecommendations = false 
      } = req.body;
      
      // Verify user owns this collection
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      // Get places for this collection (use venturrPlaces via getPlacesForCollection)
      const places = await storage.getPlacesForCollection(collectionId);
      if (places.length === 0) {
        return res.status(400).json({ error: "No places to plan. Add some posts with locations first." });
      }
      
      // Check for existing plan
      let plan = await storage.getPlanByCollection(collectionId);
      
      if (plan?.status === 'generating') {
        return res.status(409).json({ error: "Plan generation already in progress" });
      }
      
      // Create or update plan to "generating" status
      const placesHash = generatePlacesSnapshotHash(places);
      
      if (plan) {
        plan = await storage.updatePlan(plan.id, { 
          status: 'generating', 
          durationDays,
          peopleCount,
          tripPurpose,
          includeRecommendations
        });
      } else {
        plan = await storage.createPlan({
          collectionId,
          status: 'generating',
          durationDays,
          peopleCount,
          tripPurpose,
          includeRecommendations,
          placesSnapshotHash: placesHash,
        });
      }
      
      if (!plan) {
        return res.status(500).json({ error: "Failed to create plan" });
      }
      
      // Return immediately, generate in background
      res.json({ plan, message: "Plan generation started" });
      
      // Generate plan asynchronously
      generatePlanAsync(plan.id, collection.title, places, durationDays, placesHash, peopleCount, tripPurpose, includeRecommendations);
      
    } catch (error) {
      console.error("Error starting plan generation:", error);
      res.status(500).json({ error: "Failed to start plan generation" });
    }
  });

  // Delete a plan
  app.delete("/api/collections/:id/plan", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      // Verify user owns this collection
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      const plan = await storage.getPlanByCollection(collectionId);
      if (plan) {
        await storage.deletePlan(plan.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting plan:", error);
      res.status(500).json({ error: "Failed to delete plan" });
    }
  });

  // Update plan content (for editing)
  app.patch("/api/collections/:id/plan", isAuthenticated, async (req, res) => {
    try {
      const collectionId = parseInt(req.params.id);
      const userId = getUserId(req);
      const { content } = req.body;
      
      // Verify user owns this collection
      const collection = await storage.getCollection(collectionId, userId);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      
      const plan = await storage.getPlanByCollection(collectionId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      // Validate content structure
      const validated = planContentSchema.parse(content);
      
      const updated = await storage.updatePlan(plan.id, { content: validated });
      res.json(updated);
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  return httpServer;
}

// Generate a hash of place IDs for detecting changes
function generatePlacesSnapshotHash(places: { id: number }[]): string {
  const ids = places.map(p => p.id).sort((a, b) => a - b);
  return ids.join(',');
}

// Map trip purpose codes to human-readable descriptions
const TRIP_PURPOSE_LABELS: Record<string, string> = {
  date_night: "a romantic date",
  family_trip: "a family trip with children",
  friends_outing: "a group of friends",
  solo: "solo travel",
  business: "a business trip with leisure time",
};

const PEOPLE_COUNT_CONTEXT: Record<string, string> = {
  "1": "traveling alone",
  "2": "traveling as a couple",
  "3-4": "a small group of 3-4 people",
  "5+": "a larger group of 5+ people",
};

// Async plan generation using AI
async function generatePlanAsync(
  planId: number,
  collectionTitle: string,
  places: any[],
  durationDays: number,
  placesHash: string,
  peopleCount: string = "2",
  tripPurpose: string = "friends_outing",
  includeRecommendations: boolean = false
) {
  try {
    console.log(`[Plan] Generating plan for ${places.length} places over ${durationDays} days (${peopleCount} people, ${tripPurpose}, recommendations: ${includeRecommendations})`);
    
    // Calculate travel time matrix for places with coordinates
    const placesWithCoords = places.filter(p => p.lat && p.lng).map(p => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng
    }));
    const travelTimeMatrix = calculateTravelTimeMatrix(placesWithCoords);
    
    // Prepare places summary with duration data for AI
    const placesSummary = places.map(p => ({
      id: p.id,
      name: p.displayName || p.name,
      category: p.categoryPrimary || 'things to do',
      city: p.city,
      durationMinutes: p.estimatedDurationMinutes || 90,
      durationDisplay: formatDuration(p.estimatedDurationMinutes || 90),
      spanType: p.spanType || 'single', // single, multi_block, or all_day
    }));
    
    // Build travel time context (only include significant times)
    const travelTimeContext: string[] = [];
    travelTimeMatrix.forEach((minutes, key) => {
      if (minutes >= 10) { // Only mention trips >= 10 minutes
        const [id1, id2] = key.split('-').map(Number);
        const place1 = places.find(p => p.id === id1);
        const place2 = places.find(p => p.id === id2);
        if (place1 && place2) {
          travelTimeContext.push(`${place1.displayName || place1.name} → ${place2.displayName || place2.name}: ${minutes} min drive`);
        }
      }
    });
    
    // Build personalization context
    const purposeLabel = TRIP_PURPOSE_LABELS[tripPurpose] || "a casual trip";
    const peopleLabel = PEOPLE_COUNT_CONTEXT[peopleCount] || "a small group";
    
    const personalizationContext = `
## TRIP CONTEXT:
- This is ${purposeLabel}
- Party size: ${peopleLabel}
- Tailor your recommendations to this context (e.g., romantic spots for dates, kid-friendly for families, social venues for friends)
`;

    // Get the main city from the user's saved places for context
    const mainCity = places[0]?.city || 'the destination';
    const mainCountry = places[0]?.country || '';
    
    const recommendationsInstructions = includeRecommendations ? `
## AI RECOMMENDATIONS:
You may suggest 1-2 additional places per day that would complement the saved places.
Recommendations should be REAL places in ${mainCity}${mainCountry ? `, ${mainCountry}` : ''} that you know exist.

For recommended places (NOT from the user's saved list), use this block format with COMPLETE place details:
{
  "id": "rec-unique-id",
  "title": "Suggested: Place Name",
  "timeOfDay": "evening",
  "placeIds": [],
  "notes": null,
  "isRecommendation": true,
  "recommendationStatus": "pending",
  "recommendedPlace": {
    "name": "Actual Place Name",
    "category": "places to eat",
    "description": "What this place is known for and why it's special",
    "city": "${mainCity}",
    "country": "${mainCountry || 'USA'}",
    "addressFull": "Full street address if known",
    "rating": 8.5,
    "priceLevel": 2,
    "hoursDisplay": "Open daily 11am-10pm",
    "website": "https://example.com",
    "estimatedDurationMinutes": 90,
    "whyRecommended": "Perfect for ${purposeLabel} because..."
  }
}

REQUIRED fields for recommendedPlace: name, category (must be "things to do", "places to eat", or "places to stay"), description, city, whyRecommended
OPTIONAL but preferred: addressFull, rating (0-10 scale), priceLevel (1-4, where 1=$ and 4=$$$$), hoursDisplay, website, estimatedDurationMinutes

Only recommend REAL, well-known places that genuinely exist. Focus on restaurants, cafes, bars, or activities that complement the saved places and fit the trip purpose.
` : '';

    const prompt = `You are a travel planning assistant. Create a ${durationDays}-day itinerary for a trip called "${collectionTitle}".
${personalizationContext}

## SAVED PLACES (with estimated visit durations):
${JSON.stringify(placesSummary, null, 2)}

## TIME BLOCK BUDGETS:
- Morning: ${TIME_BLOCK_BUDGETS.morning} minutes (8am-12pm)
- Afternoon: ${TIME_BLOCK_BUDGETS.afternoon} minutes (12pm-5pm)  
- Evening: ${TIME_BLOCK_BUDGETS.evening} minutes (5pm-9pm)

## SPAN TYPES:
- "single" = fits in one time block (1-3 hours)
- "multi_block" = spans morning + afternoon OR afternoon + evening (4-6 hours, like skiing or theme parks)
- "all_day" = takes entire day (8+ hours, like backpacking trips)

${travelTimeContext.length > 0 ? `## TRAVEL TIMES BETWEEN PLACES:\n${travelTimeContext.slice(0, 15).join('\n')}\n` : ''}

## CRITICAL SCHEDULING RULES:
1. NEVER put multiple long activities (>120 min each) in the same time block
2. When scheduling activities in a block, TOTAL TIME (activity + travel) must fit the block budget
3. Multi-block activities like skiing or theme parks should span morning+afternoon or be the only activity for that half-day
4. All-day activities get their own day
5. "Places to eat" are flexible (30-90 min) and can pair with activities
6. Group nearby places together to minimize travel time
${recommendationsInstructions}
## OUTPUT FORMAT:
Return ONLY valid JSON (no markdown):
{
  "overview": {
    "summary": "Brief 1-2 sentence trip description",
    "travelTips": ["Optional tip 1"]
  },
  "days": [
    {
      "dayNumber": 1,
      "title": "Day theme like 'Mountain Adventures'",
      "blocks": [
        {
          "id": "unique-id",
          "title": "Block title",
          "timeOfDay": "morning",
          "placeIds": [1],
          "notes": "Optional notes"
        }
      ]
    }
  ]
}

timeOfDay options: morning, afternoon, evening, flexible
Only use place IDs from the list above.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || '';
    
    // Parse and validate the response
    let content: PlanContent;
    try {
      // Remove markdown code blocks if present
      const jsonStr = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      content = planContentSchema.parse(parsed);
    } catch (parseError) {
      console.error("[Plan] Failed to parse AI response:", parseError);
      console.error("[Plan] Raw response:", responseText);
      await storage.updatePlan(planId, { status: 'failed' });
      return;
    }

    // Validate and flag overpacked blocks
    const validationWarnings = validatePlanSchedule(content, placesSummary, travelTimeMatrix);
    if (validationWarnings.length > 0) {
      console.log(`[Plan] Schedule warnings: ${validationWarnings.join('; ')}`);
      // Add warnings to overview notes
      if (!content.notes) {
        content.notes = '';
      }
      content.notes = validationWarnings.join('\n') + (content.notes ? '\n\n' + content.notes : '');
    }

    // Update plan with generated content
    await storage.updatePlan(planId, {
      status: 'ready',
      content,
      placesSnapshotHash: placesHash,
      generatedAt: new Date(),
    });
    
    console.log(`[Plan] Successfully generated plan with ${content.days.length} days`);
    
  } catch (error) {
    console.error("[Plan] Generation error:", error);
    await storage.updatePlan(planId, { status: 'failed' });
  }
}

// Validate plan schedule for overpacked blocks
function validatePlanSchedule(
  content: PlanContent,
  placesSummary: Array<{ id: number; name: string; category: string; durationMinutes: number; spanType: string }>,
  travelTimeMatrix: Map<string, number>
): string[] {
  const warnings: string[] = [];
  
  const placeLookup = new Map(placesSummary.map(p => [p.id, p]));
  
  for (const day of content.days) {
    for (const block of day.blocks) {
      const blockPlaces = block.placeIds
        .map(id => placeLookup.get(id))
        .filter(Boolean) as Array<{ id: number; name: string; category: string; durationMinutes: number; spanType: string }>;
      
      if (blockPlaces.length === 0) continue;
      
      // Get block time budget
      const timeOfDay = block.timeOfDay || 'flexible';
      const budget = TIME_BLOCK_BUDGETS[timeOfDay as keyof typeof TIME_BLOCK_BUDGETS] || 180;
      
      // Sum activity durations
      const totalActivityTime = blockPlaces.reduce((sum, p) => sum + p.durationMinutes, 0);
      
      // Estimate travel time between places in block
      let totalTravelTime = 0;
      for (let i = 0; i < blockPlaces.length - 1; i++) {
        const key = `${blockPlaces[i].id}-${blockPlaces[i + 1].id}`;
        const travelTime = travelTimeMatrix.get(key) || 15; // Default 15 min if unknown
        totalTravelTime += travelTime;
      }
      
      const totalTime = totalActivityTime + totalTravelTime;
      
      // Check if over budget
      if (totalTime > budget * 1.2) { // 20% tolerance
        const overBy = totalTime - budget;
        const placeNames = blockPlaces.map(p => p.name).join(', ');
        warnings.push(
          `Day ${day.dayNumber} ${block.timeOfDay}: May be tight (${formatDuration(totalTime)} for ${formatDuration(budget)} block) - ${placeNames}`
        );
      }
      
      // Check for multi-block activities grouped with other non-meal/non-stay activities
      const multiBlockActivities = blockPlaces.filter(p => p.spanType === 'multi_block');
      const nonMealActivities = blockPlaces.filter(p => 
        p.durationMinutes >= 60 && !['places to eat', 'places to stay'].includes(p.category)
      );
      if (multiBlockActivities.length > 0 && nonMealActivities.length > 1) {
        const longActivity = multiBlockActivities[0];
        warnings.push(
          `Day ${day.dayNumber}: "${longActivity.name}" (${formatDuration(longActivity.durationMinutes)}) may need its own time block`
        );
      }
    }
  }
  
  return warnings;
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

  // Combine title and description for better place extraction
  // Description often contains location details not in title
  let caption = data.title || null;
  if (data.description && data.description !== data.title) {
    caption = caption ? `${caption}\n\n${data.description}` : data.description;
  }
  
  return {
    source,
    thumbnailUrl: data.thumbnail_url || null,
    caption,
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
- city: The city (if you can determine it). IMPORTANT: For US locations, include the state (e.g., "Austin, Texas")
- country: The country (if you can determine it)
- category: One of these THREE categories only:
  * "things to do" - attractions, landmarks, activities, nature, parks, museums, tours, entertainment, sports venues
  * "places to eat" - restaurants, cafes, bars, food markets, bakeries
  * "places to stay" - hotels, resorts, hostels, vacation rentals, accommodations
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
   - "Chelsea FC match" → name: "Stamford Bridge - Chelsea FC Match"
   - "Lakers game" → name: "Crypto.com Arena - Lakers Game"
2. Include the ACTIVITY in the name when it's the main draw (e.g., "Borough Market - Food Tour", "Thames - River Cruise")
3. Only extract places someone can physically visit - skip abstract concepts, brands, or online services
4. When uncertain if something is a real visitable place, set confidence below 0.5

For each place, provide:
- name: The venue name, optionally with the activity/experience (e.g., "Stamford Bridge - Chelsea FC Match")
- city: The city or region. IMPORTANT: For US locations, you MUST include the state name (e.g., "Summit County, Colorado" or "Austin, Texas" - NEVER just "Summit County" or "Austin")
- country: The country (if mentioned or can be inferred)
- category: One of these THREE categories only:
  * "things to do" - attractions, landmarks, activities, nature, parks, museums, tours, entertainment, sports venues, beaches, hiking, skiing, theme parks
  * "places to eat" - restaurants, cafes, bars, food markets, bakeries, nightlife venues
  * "places to stay" - hotels, resorts, hostels, vacation rentals, accommodations
- confidence: A score from 0 to 1 indicating how confident you are this is a real visitable place

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
- Use "things to do" for attractions, landmarks, activities, nature, parks, museums, tours, entertainment, sports venues, beaches, hiking, skiing, theme parks
- Use "places to eat" for restaurants, cafes, bars, food markets, bakeries, nightlife venues
- Use "places to stay" for hotels, resorts, hostels, vacation rentals, accommodations

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
