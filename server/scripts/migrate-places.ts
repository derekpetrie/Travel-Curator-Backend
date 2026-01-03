import { db } from "../db";
import { places, posts, collections, venturrPlaces, postPlaceLinks } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { matchOrCreateVenturrPlace } from "../lib/place-matching";

async function migratePlaces() {
  console.log("[Migration] Starting place migration to VenturrPlace system...");

  // Get all legacy places with their associated post info
  const legacyPlaces = await db
    .select({
      id: places.id,
      collectionId: places.collectionId,
      name: places.name,
      city: places.city,
      country: places.country,
      category: places.category,
      lat: places.lat,
      lng: places.lng,
      confidence: places.confidence,
      createdAt: places.createdAt,
    })
    .from(places)
    .orderBy(places.createdAt);

  console.log(`[Migration] Found ${legacyPlaces.length} legacy places to migrate`);

  // For each legacy place, we need to find the post it belongs to
  // Since legacy places don't have a postId, we'll need to find posts by collectionId
  // and create links for all posts in that collection

  const placesByCollection = new Map<number, typeof legacyPlaces>();
  for (const place of legacyPlaces) {
    const existing = placesByCollection.get(place.collectionId) || [];
    existing.push(place);
    placesByCollection.set(place.collectionId, existing);
  }

  let migratedCount = 0;
  let matchedCount = 0;
  let newCount = 0;
  let errorCount = 0;

  for (const [collectionId, collectionPlaces] of Array.from(placesByCollection)) {
    // Get posts for this collection
    const collectionPosts = await db
      .select()
      .from(posts)
      .where(eq(posts.collectionId, collectionId));

    if (collectionPosts.length === 0) {
      console.log(`[Migration] Collection ${collectionId} has no posts, skipping places`);
      continue;
    }

    // Use the first post as the "owner" of these places
    const firstPost = collectionPosts[0];

    for (const legacyPlace of collectionPlaces) {
      try {
        // Match or create VenturrPlace
        const { place: venturrPlace, isNew, matchType } = await matchOrCreateVenturrPlace({
          name: legacyPlace.name,
          city: legacyPlace.city,
          country: legacyPlace.country,
          category: legacyPlace.category || 'things to do',
          lat: legacyPlace.lat,
          lng: legacyPlace.lng,
          confidence: legacyPlace.confidence || undefined,
        });

        // Check if link already exists
        const existingLinks = await db
          .select()
          .from(postPlaceLinks)
          .where(
            sql`${postPlaceLinks.postId} = ${firstPost.id} AND ${postPlaceLinks.placeId} = ${venturrPlace.id}`
          );

        if (existingLinks.length === 0) {
          // Create PostPlaceLink
          await db.insert(postPlaceLinks).values({
            postId: firstPost.id,
            placeId: venturrPlace.id,
            confidence: legacyPlace.confidence,
            linkType: 'extracted',
          });
        }

        if (isNew) {
          newCount++;
        } else {
          matchedCount++;
        }
        migratedCount++;

        console.log(
          `[Migration] ${migratedCount}/${legacyPlaces.length}: "${legacyPlace.name}" -> VenturrPlace ${venturrPlace.id} (${isNew ? 'new' : matchType})`
        );
      } catch (err) {
        errorCount++;
        console.error(`[Migration] Error migrating place "${legacyPlace.name}":`, err);
      }
    }
  }

  console.log("\n[Migration] Complete!");
  console.log(`  Total migrated: ${migratedCount}`);
  console.log(`  Matched to existing: ${matchedCount}`);
  console.log(`  Created new: ${newCount}`);
  console.log(`  Errors: ${errorCount}`);

  // Show stats
  const venturrPlaceCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(venturrPlaces);
  const linkCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(postPlaceLinks);

  console.log(`\n[Migration] Database stats:`);
  console.log(`  VenturrPlaces: ${venturrPlaceCount[0]?.count || 0}`);
  console.log(`  PostPlaceLinks: ${linkCount[0]?.count || 0}`);
}

// Run migration
migratePlaces()
  .then(() => {
    console.log("[Migration] Script completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[Migration] Script failed:", err);
    process.exit(1);
  });
