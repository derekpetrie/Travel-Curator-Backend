import { db } from "./db";
import { 
  collections, posts, places,
  type Collection, type InsertCollection,
  type Post, type InsertPost,
  type Place, type InsertPlace
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Collections
  getCollections(userId: string): Promise<Collection[]>;
  getCollection(id: number, userId: string): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  updateCollection(id: number, userId: string, updates: { title?: string; coverImage?: string | null; coverGradient?: string | null; summary?: string | null }): Promise<Collection | undefined>;
  updateCollectionThumbnail(id: number, userId: string, coverImage: string | null, coverGradient: string | null): Promise<void>;
  deleteCollection(id: number, userId: string): Promise<void>;
  
  // Posts
  getPosts(collectionId: number): Promise<Post[]>;
  getPost(id: number): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  deletePost(id: number): Promise<void>;
  
  // Places
  getPlaces(collectionId: number): Promise<Place[]>;
  getPlace(id: number): Promise<Place | undefined>;
  createPlace(place: InsertPlace): Promise<Place>;
  deletePlace(id: number): Promise<void>;
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
      .set(updates)
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
      .set({ coverImage, coverGradient })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  }

  async deleteCollection(id: number, userId: string): Promise<void> {
    await db.delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)));
  }

  // Posts
  async getPosts(collectionId: number): Promise<Post[]> {
    return await db.select().from(posts)
      .where(eq(posts.collectionId, collectionId))
      .orderBy(desc(posts.createdAt));
  }

  async getPost(id: number): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id));
    return result[0];
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
}

export const storage = new DatabaseStorage();
