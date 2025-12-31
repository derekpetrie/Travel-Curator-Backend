import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { 
  users, collections, posts, places,
  type User, type InsertUser,
  type Collection, type InsertCollection,
  type Post, type InsertPost,
  type Place, type InsertPlace
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL!,
});

await client.connect();
export const db = drizzle(client);

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Collections
  getCollections(): Promise<Collection[]>;
  getCollection(id: number): Promise<Collection | undefined>;
  createCollection(collection: InsertCollection): Promise<Collection>;
  deleteCollection(id: number): Promise<void>;
  
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
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Collections
  async getCollections(): Promise<Collection[]> {
    return await db.select().from(collections).orderBy(desc(collections.createdAt));
  }

  async getCollection(id: number): Promise<Collection | undefined> {
    const result = await db.select().from(collections).where(eq(collections.id, id));
    return result[0];
  }

  async createCollection(collection: InsertCollection): Promise<Collection> {
    const result = await db.insert(collections).values(collection).returning();
    return result[0];
  }

  async deleteCollection(id: number): Promise<void> {
    await db.delete(collections).where(eq(collections.id, id));
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
