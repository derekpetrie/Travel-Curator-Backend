import { db } from "../db";
import { posts, venturrPlaces } from "@shared/schema";
import { isNotNull, sql } from "drizzle-orm";
import pLimit from "p-limit";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const IFRAMELY_API_KEY = process.env.IFRAMELY_API_KEY;
const BASE_URL = "https://places.googleapis.com/v1";

interface RefreshStats {
  placesProcessed: number;
  placesUpdated: number;
  placesFailed: number;
  postsProcessed: number;
  postsUpdated: number;
  postsFailed: number;
}

async function fetchGooglePlacePhoto(googlePlaceId: string): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error("[Refresh] GOOGLE_PLACES_API_KEY not configured");
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}/places/${googlePlaceId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "photos",
      },
    });

    if (!response.ok) {
      console.error(`[Refresh] Google API error for ${googlePlaceId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.photos && data.photos.length > 0) {
      return data.photos[0].name;
    }
    return null;
  } catch (error) {
    console.error(`[Refresh] Error fetching Google photo for ${googlePlaceId}:`, error);
    return null;
  }
}

async function fetchIframelyThumbnail(url: string): Promise<string | null> {
  if (!IFRAMELY_API_KEY) {
    console.error("[Refresh] IFRAMELY_API_KEY not configured");
    return null;
  }

  try {
    const iframelyUrl = `https://iframe.ly/api/oembed?url=${encodeURIComponent(url)}&api_key=${IFRAMELY_API_KEY}`;
    const response = await fetch(iframelyUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      console.error(`[Refresh] Iframely error for ${url}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.thumbnail_url || null;
  } catch (error) {
    console.error(`[Refresh] Error fetching Iframely thumbnail for ${url}:`, error);
    return null;
  }
}

async function refreshPlacePhotos(stats: RefreshStats): Promise<void> {
  console.log("\n=== Refreshing Place Photos ===\n");

  const placesWithGoogleId = await db
    .select({
      id: venturrPlaces.id,
      name: venturrPlaces.name,
      googlePlaceId: venturrPlaces.googlePlaceId,
      photoUrl: venturrPlaces.photoUrl,
    })
    .from(venturrPlaces)
    .where(isNotNull(venturrPlaces.googlePlaceId));

  console.log(`Found ${placesWithGoogleId.length} places with Google Place IDs`);

  const limit = pLimit(5);

  const tasks = placesWithGoogleId.map((place) =>
    limit(async () => {
      stats.placesProcessed++;
      console.log(`[${stats.placesProcessed}/${placesWithGoogleId.length}] Processing: ${place.name}`);

      const photoRef = await fetchGooglePlacePhoto(place.googlePlaceId!);

      if (photoRef) {
        await db
          .update(venturrPlaces)
          .set({ photoUrl: photoRef })
          .where(sql`${venturrPlaces.id} = ${place.id}`);
        stats.placesUpdated++;
        console.log(`  ✓ Updated photo for "${place.name}"`);
      } else {
        stats.placesFailed++;
        console.log(`  ✗ No photo found for "${place.name}"`);
      }
    })
  );

  await Promise.all(tasks);
}

async function refreshPostThumbnails(stats: RefreshStats): Promise<void> {
  console.log("\n=== Refreshing Post Thumbnails ===\n");

  const allPosts = await db
    .select({
      id: posts.id,
      url: posts.url,
      source: posts.source,
      thumbnailUrl: posts.thumbnailUrl,
    })
    .from(posts);

  console.log(`Found ${allPosts.length} posts to refresh`);

  const limit = pLimit(3);
  let requestCount = 0;
  const startTime = Date.now();

  const tasks = allPosts.map((post) =>
    limit(async () => {
      requestCount++;
      const elapsed = Date.now() - startTime;
      const requestsPerMinute = (requestCount / elapsed) * 60000;
      
      if (requestsPerMinute > 55) {
        const waitTime = Math.ceil((requestCount / 55) * 60000 - elapsed);
        if (waitTime > 0) {
          console.log(`  [Rate limit] Waiting ${waitTime}ms...`);
          await new Promise((r) => setTimeout(r, waitTime));
        }
      }

      stats.postsProcessed++;
      console.log(`[${stats.postsProcessed}/${allPosts.length}] Processing: ${post.source} post ${post.id}`);

      const thumbnailUrl = await fetchIframelyThumbnail(post.url);

      if (thumbnailUrl) {
        await db
          .update(posts)
          .set({ thumbnailUrl })
          .where(sql`${posts.id} = ${post.id}`);
        stats.postsUpdated++;
        console.log(`  ✓ Updated thumbnail for post ${post.id}`);
      } else {
        stats.postsFailed++;
        console.log(`  ✗ No thumbnail found for post ${post.id}`);
      }
    })
  );

  await Promise.all(tasks);
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("  Thumbnail Refresh Script");
  console.log("========================================");
  console.log(`Started at: ${new Date().toISOString()}`);

  const stats: RefreshStats = {
    placesProcessed: 0,
    placesUpdated: 0,
    placesFailed: 0,
    postsProcessed: 0,
    postsUpdated: 0,
    postsFailed: 0,
  };

  await refreshPlacePhotos(stats);
  await refreshPostThumbnails(stats);

  console.log("\n========================================");
  console.log("  Summary");
  console.log("========================================");
  console.log(`Places: ${stats.placesUpdated}/${stats.placesProcessed} updated (${stats.placesFailed} failed)`);
  console.log(`Posts: ${stats.postsUpdated}/${stats.postsProcessed} updated (${stats.postsFailed} failed)`);
  console.log(`Completed at: ${new Date().toISOString()}`);
}

main()
  .then(() => {
    console.log("\nScript completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nScript failed with error:", error);
    process.exit(1);
  });
