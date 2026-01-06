import { db } from "./db";
import { 
  collections, posts, places, venturrPlaces, postPlaceLinks, plans,
  type Collection, type InsertCollection,
  type Post, type InsertPost,
  type Place, type InsertPlace,
  type VenturrPlace, type InsertVenturrPlace,
  type PostPlaceLink, type InsertPostPlaceLink,
  type Plan, type InsertPlan, type PlanContent
} from "@shared/schema";
import { eq, desc, asc, and, sql } from "drizzle-orm";

export interface IStorage {
  // Collections
  getCollections(userId: string): Promise<Collection[]>;
  getCollection(id: number, userId: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: number, userId: string, updates: { title?: string; coverImage?: string | null; coverGradient?: string | null; summary?: string | null }): Promise<Collection | undefined>;
  updateCollectionThumbnail(id: number, userId: string, coverImage: string | null, coverGradient: string | null): Promise<void>;
  touchCollection(id: number): Promise<void>;
  deleteCollection(id: number, userId: string): Promise<void>;
  
  // Posts
  getPosts(collectionId: number): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  postExistsInCollection(collectionId: number, url: string): Promise<boolean>;
  createPost(post: InsertPost): Promise<Post>;
  deletePost(id: number): Promise<void>;
  
  // Legacy Places (will be deprecated after migration)
  getPlaces(collectionId: number): Promise<Place[]>;
  getAllPlaces(): Promise<Place[]>;
  getPlacesByUser(userId: string): Promise<Place[]>;
  getPlace(id: number): Promise<Place | undefined>;
  createPlace(place: InsertPlace): Promise<Place>;
  updatePlaceCategory(id: number, category: string): Promise<void>;
  deletePlace(id: number): Promise<void>;
  
  // VenturrPlaces (canonical global places)
  getVenturrPlace(id: number): Promise<VenturrPlace | undefined>;
  getVenturrPlaceByGoogleId(googlePlaceId: string): Promise<VenturrPlace | undefined>;
  createVenturrPlace(place: InsertVenturrPlace): Promise<VenturrPlace>;
  updateVenturrPlace(id: number, updates: Partial<InsertVenturrPlace>): Promise<VenturrPlace | undefined>;
  findNearbyVenturrPlaces(lat: number, lng: number, radiusMeters: number, category?: string): Promise<VenturrPlace[]>;
  findVenturrPlacesByCity(city: string, country: string | null, category?: string): Promise<VenturrPlace[]>;
  
  // PostPlaceLinks (user's connection to places)
  createPostPlaceLink(link: InsertPostPlaceLink): Promise<PostPlaceLink>;
  getPostPlaceLinks(postId: number): Promise<PostPlaceLink[]>;
  getPostPlaceLinkWithOwnership(linkId: number, userId: string): Promise<{ link: PostPlaceLink; collectionId: number } | undefined>;
  getPlacesForCollection(collectionId: number): Promise<(VenturrPlace & { linkId: number; confidence: number | null; linkType: string })[]>;
  getPlacesForUser(userId: string): Promise<(VenturrPlace & { collectionId: number; linkId: number })[]>;
  deletePostPlaceLink(id: number): Promise<void>;
  
  // Plans
  getPlanByCollection(collectionId: number): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  getPublicPlans(limit?: number): Promise<(Plan & { collectionTitle: string })[]>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: number, updates: { status?: string; content?: PlanContent; placesSnapshotHash?: string; durationDays?: number; generatedAt?: Date; isPublic?: boolean; shareSlug?: string }): Promise<Plan | undefined>;
  deletePlan(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Collections - now scoped by userId
  async getCollections(userId: string): Promise<Collection[]> {
    return await db.select().from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.createdAt));
  }

  async getCollection(id: number, userId: string): Promise<Collection | undefined> {
    const result = await db.select().from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)));
    return result[0];
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const result = await db.insert(collections).values(collection).returning();
    return result[0];
  }

  async updateCollection(
    id: number,
    userId: string,
    updates: { title?: string; coverImage?: string | null; coverGradient?: string | null; summary?: string | null }
  ): Promise<Collection | undefined> {
    const result = await db.update(collections)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();
    return result[0];
  }

  async updateCollectionThumbnail(
    id: number,
    userId: string,
    coverImage: string | null,
    coverGradient: string | null
  ): Promise<void> {
    await db.update(collections)
      .set({ coverImage, coverGradient, updatedAt: new Date() })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  }

  async touchCollection(id: number): Promise<void> {
    await db.update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, id));
  }

  async deleteCollection(id: number, userId: string): Promise<void> {
    await db.delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  }

  // Posts - ordered by createdAt ASC so first post is the earliest added
  async getPosts(collectionId: number): Promise<Post[]> {
    return await db.select().from(posts)
      .where(eq(posts.collectionId, collectionId))
      .orderBy(asc(posts.createdAt));
  }

  async getPost(id: number): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id));
    return result[0];
  }

  async postExistsInCollection(collectionId: number, url: string): Promise<boolean> {
    const result = await db.select({ id: posts.id }).from(posts)
      .where(and(eq(posts.collectionId, collectionId), eq(posts.url, url)))
      .limit(1);
    return result.length > 0;
  }

  async createPost(post: InsertPost): Promise<Post> {
    const result = await db.insert(posts).values(post).returning();
    return result[0];
  }

  async deletePost(id: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  // Places
  async getPlaces(collectionId: number): Promise<Place[]> {
    return await db.select().from(places)
      .where(eq(places.collectionId, collectionId))
      .orderBy(desc(places.createdAt));
  }

  async getPlace(id: number): Promise<Place | undefined> {
    const result = await db.select().from(places).where(eq(places.id, id));
    return result[0];
  }

  async createPlace(place: InsertPlace): Promise<Place> {
    const result = await db.insert(places).values(place).returning();
    return result[0];
  }

  async deletePlace(id: number): Promise<void> {
    await db.delete(places).where(eq(places.id, id));
  }

  async getAllPlaces(): Promise<Place[]> {
    return await db.select().from(places).orderBy(desc(places.createdAt));
  }

  async getPlacesByUser(userId: string): Promise<Place[]> {
    return await db.select({
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
    }).from(places)
      .innerJoin(collections, eq(places.collectionId, collections.id))
      .where(eq(collections.userId, userId))
      .orderBy(desc(places.createdAt));
  }

  async updatePlaceCategory(id: number, category: string): Promise<void> {
    await db.update(places).set({ category }).where(eq(places.id, id));
  }

  // VenturrPlaces (canonical global places)
  async getVenturrPlace(id: number): Promise<VenturrPlace | undefined> {
    const result = await db.select().from(venturrPlaces).where(eq(venturrPlaces.id, id));
    return result[0];
  }

  async getVenturrPlaceByGoogleId(googlePlaceId: string): Promise<VenturrPlace | undefined> {
    const result = await db.select().from(venturrPlaces)
      .where(eq(venturrPlaces.googlePlaceId, googlePlaceId));
    return result[0];
  }

  async createVenturrPlace(place: InsertVenturrPlace): Promise<VenturrPlace> {
    const result = await db.insert(venturrPlaces).values(place).returning();
    return result[0];
  }

  async updateVenturrPlace(id: number, updates: Partial<InsertVenturrPlace>): Promise<VenturrPlace | undefined> {
    const result = await db.update(venturrPlaces)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(venturrPlaces.id, id))
      .returning();
    return result[0];
  }

  async findNearbyVenturrPlaces(
    lat: number, 
    lng: number, 
    radiusMeters: number, 
    category?: string
  ): Promise<VenturrPlace[]> {
    // Use Haversine formula to calculate distance
    // 6371000 is Earth's radius in meters
    const result = await db.select().from(venturrPlaces)
      .where(
        and(
          sql`${venturrPlaces.lat} IS NOT NULL`,
          sql`${venturrPlaces.lng} IS NOT NULL`,
          sql`${venturrPlaces.placeStatus} IN ('active', 'needs_review')`,
          category ? eq(venturrPlaces.categoryPrimary, category) : sql`1=1`,
          sql`(
            6371000 * acos(
              cos(radians(${lat})) * cos(radians(${venturrPlaces.lat})) * 
              cos(radians(${venturrPlaces.lng}) - radians(${lng})) + 
              sin(radians(${lat})) * sin(radians(${venturrPlaces.lat}))
            )
          ) <= ${radiusMeters}`
        )
      )
      .orderBy(
        sql`(
          6371000 * acos(
            cos(radians(${lat})) * cos(radians(${venturrPlaces.lat})) * 
            cos(radians(${venturrPlaces.lng}) - radians(${lng})) + 
            sin(radians(${lat})) * sin(radians(${venturrPlaces.lat}))
          )
        )`
      )
      .limit(20);
    return result;
  }

  async findVenturrPlacesByCity(
    city: string, 
    country: string | null, 
    category?: string
  ): Promise<VenturrPlace[]> {
    const conditions = [
      sql`LOWER(${venturrPlaces.city}) = LOWER(${city})`,
      sql`${venturrPlaces.placeStatus} IN ('active', 'needs_review')`
    ];
    if (country) {
      conditions.push(sql`LOWER(${venturrPlaces.country}) = LOWER(${country})`);
    }
    if (category) {
      conditions.push(eq(venturrPlaces.categoryPrimary, category));
    }
    
    return await db.select().from(venturrPlaces)
      .where(and(...conditions))
      .orderBy(venturrPlaces.name)
      .limit(50);
  }

  // PostPlaceLinks (user's connection to places)
  async createPostPlaceLink(link: InsertPostPlaceLink): Promise<PostPlaceLink> {
    const result = await db.insert(postPlaceLinks).values(link).returning();
    return result[0];
  }

  async getPostPlaceLinks(postId: number): Promise<PostPlaceLink[]> {
    return await db.select().from(postPlaceLinks)
      .where(eq(postPlaceLinks.postId, postId));
  }

  async getPostPlaceLinkWithOwnership(
    linkId: number, 
    userId: string
  ): Promise<{ link: PostPlaceLink; collectionId: number } | undefined> {
    const result = await db.select({
      id: postPlaceLinks.id,
      postId: postPlaceLinks.postId,
      placeId: postPlaceLinks.placeId,
      confidence: postPlaceLinks.confidence,
      linkType: postPlaceLinks.linkType,
      createdAt: postPlaceLinks.createdAt,
      collectionId: posts.collectionId,
    })
      .from(postPlaceLinks)
      .innerJoin(posts, eq(postPlaceLinks.postId, posts.id))
      .innerJoin(collections, eq(posts.collectionId, collections.id))
      .where(and(eq(postPlaceLinks.id, linkId), eq(collections.userId, userId)));
    
    if (result.length === 0) return undefined;
    
    const row = result[0];
    return {
      link: {
        id: row.id,
        postId: row.postId,
        placeId: row.placeId,
        confidence: row.confidence,
        linkType: row.linkType,
        createdAt: row.createdAt,
      },
      collectionId: row.collectionId,
    };
  }

  async getPlacesForCollection(
    collectionId: number
  ): Promise<(VenturrPlace & { linkId: number; confidence: number | null; linkType: string })[]> {
    const result = await db.select({
      id: venturrPlaces.id,
      name: venturrPlaces.name,
      displayName: venturrPlaces.displayName,
      categoryPrimary: venturrPlaces.categoryPrimary,
      addressFull: venturrPlaces.addressFull,
      city: venturrPlaces.city,
      region: venturrPlaces.region,
      postalCode: venturrPlaces.postalCode,
      country: venturrPlaces.country,
      lat: venturrPlaces.lat,
      lng: venturrPlaces.lng,
      geoPrecision: venturrPlaces.geoPrecision,
      placeStatus: venturrPlaces.placeStatus,
      fsqId: venturrPlaces.fsqId,
      fsqData: venturrPlaces.fsqData,
      fsqFetchedAt: venturrPlaces.fsqFetchedAt,
      photoUrl: venturrPlaces.photoUrl,
      rating: venturrPlaces.rating,
      website: venturrPlaces.website,
      phone: venturrPlaces.phone,
      hoursDisplay: venturrPlaces.hoursDisplay,
      isOpenNow: venturrPlaces.isOpenNow,
      priceLevel: venturrPlaces.priceLevel,
      googlePlaceId: venturrPlaces.googlePlaceId,
      googleData: venturrPlaces.googleData,
      googleFetchedAt: venturrPlaces.googleFetchedAt,
      enrichmentStatus: venturrPlaces.enrichmentStatus,
      estimatedDurationMinutes: venturrPlaces.estimatedDurationMinutes,
      spanType: venturrPlaces.spanType,
      durationSource: venturrPlaces.durationSource,
      createdAt: venturrPlaces.createdAt,
      updatedAt: venturrPlaces.updatedAt,
      linkId: postPlaceLinks.id,
      confidence: postPlaceLinks.confidence,
      linkType: postPlaceLinks.linkType,
    })
      .from(postPlaceLinks)
      .innerJoin(venturrPlaces, eq(postPlaceLinks.placeId, venturrPlaces.id))
      .innerJoin(posts, eq(postPlaceLinks.postId, posts.id))
      .where(eq(posts.collectionId, collectionId))
      .orderBy(desc(postPlaceLinks.createdAt));
    return result;
  }

  async getPlacesForUser(
    userId: string
  ): Promise<(VenturrPlace & { collectionId: number; linkId: number })[]> {
    const result = await db.select({
      id: venturrPlaces.id,
      name: venturrPlaces.name,
      displayName: venturrPlaces.displayName,
      categoryPrimary: venturrPlaces.categoryPrimary,
      addressFull: venturrPlaces.addressFull,
      city: venturrPlaces.city,
      region: venturrPlaces.region,
      postalCode: venturrPlaces.postalCode,
      country: venturrPlaces.country,
      lat: venturrPlaces.lat,
      lng: venturrPlaces.lng,
      geoPrecision: venturrPlaces.geoPrecision,
      placeStatus: venturrPlaces.placeStatus,
      fsqId: venturrPlaces.fsqId,
      fsqData: venturrPlaces.fsqData,
      fsqFetchedAt: venturrPlaces.fsqFetchedAt,
      photoUrl: venturrPlaces.photoUrl,
      rating: venturrPlaces.rating,
      website: venturrPlaces.website,
      phone: venturrPlaces.phone,
      hoursDisplay: venturrPlaces.hoursDisplay,
      isOpenNow: venturrPlaces.isOpenNow,
      priceLevel: venturrPlaces.priceLevel,
      googlePlaceId: venturrPlaces.googlePlaceId,
      googleData: venturrPlaces.googleData,
      googleFetchedAt: venturrPlaces.googleFetchedAt,
      enrichmentStatus: venturrPlaces.enrichmentStatus,
      estimatedDurationMinutes: venturrPlaces.estimatedDurationMinutes,
      spanType: venturrPlaces.spanType,
      durationSource: venturrPlaces.durationSource,
      createdAt: venturrPlaces.createdAt,
      updatedAt: venturrPlaces.updatedAt,
      collectionId: posts.collectionId,
      linkId: postPlaceLinks.id,
    })
      .from(postPlaceLinks)
      .innerJoin(venturrPlaces, eq(postPlaceLinks.placeId, venturrPlaces.id))
      .innerJoin(posts, eq(postPlaceLinks.postId, posts.id))
      .innerJoin(collections, eq(posts.collectionId, collections.id))
      .where(eq(collections.userId, userId))
      .orderBy(desc(postPlaceLinks.createdAt));
    return result;
  }

  async deletePostPlaceLink(id: number): Promise<void> {
    await db.delete(postPlaceLinks).where(eq(postPlaceLinks.id, id));
  }

  // Plans
  async getPlanByCollection(collectionId: number): Promise<Plan | undefined> {
    const result = await db.select().from(plans)
      .where(eq(plans.collectionId, collectionId))
      .limit(1);
    return result[0];
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const result = await db.insert(plans).values(plan).returning();
    return result[0];
  }

  async updatePlan(
    id: number,
    updates: { status?: string; content?: PlanContent; placesSnapshotHash?: string; durationDays?: number; generatedAt?: Date; isPublic?: boolean; shareSlug?: string }
  ): Promise<Plan | undefined> {
    const result = await db.update(plans)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return result[0];
  }

  async deletePlan(id: number): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  async getPlanBySlug(slug: string): Promise<Plan | undefined> {
    const result = await db.select().from(plans)
      .where(eq(plans.shareSlug, slug))
      .limit(1);
    return result[0];
  }

  async getPublicPlans(limit: number = 20): Promise<(Plan & { collectionTitle: string })[]> {
    const result = await db.select({
      id: plans.id,
      collectionId: plans.collectionId,
      status: plans.status,
      durationDays: plans.durationDays,
      content: plans.content,
      placesSnapshotHash: plans.placesSnapshotHash,
      generatedAt: plans.generatedAt,
      isPublic: plans.isPublic,
      shareSlug: plans.shareSlug,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
      collectionTitle: collections.title,
    })
      .from(plans)
      .innerJoin(collections, eq(plans.collectionId, collections.id))
      .where(eq(plans.isPublic, true))
      .orderBy(desc(plans.updatedAt))
      .limit(limit);
    return result;
  }
}

export const storage = new DatabaseStorage();
