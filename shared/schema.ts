import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, jsonb, integer, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  coverImage: text("cover_image"),
  coverGradient: text("cover_gradient"),
  summary: text("summary"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  collectionId: integer("collection_id").references(() => collections.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  author: text("author"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Legacy places table - will be migrated to venturr_places + post_place_links
export const places = pgTable("places", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  collectionId: integer("collection_id").references(() => collections.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  city: text("city"),
  country: text("country"),
  category: text("category"),
  lat: real("lat"),
  lng: real("lng"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Global canonical place database - shared across all users
export const venturrPlaces = pgTable("venturr_places", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  categoryPrimary: text("category_primary").notNull(), // "things to do" | "places to eat" | "places to stay"
  addressFull: text("address_full"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  country: text("country"),
  lat: real("lat"),
  lng: real("lng"),
  geoPrecision: text("geo_precision").default("unknown"), // "exact" | "approx" | "unknown"
  placeStatus: text("place_status").default("active").notNull(), // "active" | "needs_review" | "duplicate" | "closed"
  // Foursquare enrichment
  fsqId: text("fsq_id"),
  fsqData: jsonb("fsq_data"), // FoursquareEnrichmentData (full JSON for less-used fields)
  fsqFetchedAt: timestamp("fsq_fetched_at"),
  // Flattened Foursquare fields for common display
  photoUrl: text("photo_url"),
  rating: real("rating"),
  website: text("website"),
  phone: text("phone"),
  hoursDisplay: text("hours_display"), // e.g. "Mon-Fri 9am-5pm"
  isOpenNow: boolean("is_open_now"),
  priceLevel: integer("price_level"), // 1-4
  // Future Google Places enrichment
  googlePlaceId: text("google_place_id"),
  googleData: jsonb("google_data"),
  googleFetchedAt: timestamp("google_fetched_at"),
  enrichmentStatus: text("enrichment_status").default("not_started"), // "not_started" | "pending" | "enriched" | "failed"
  // Duration estimation for itinerary planning
  estimatedDurationMinutes: integer("estimated_duration_minutes"), // null = unknown
  spanType: text("span_type").default("single"), // "single" | "multi_block" | "all_day"
  durationSource: text("duration_source"), // "category_heuristic" | "google_hours" | "ai_estimate" | "user_override"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Links posts to canonical places - this is the privacy layer
// Users access places through their posts, not directly
export const postPlaceLinks = pgTable("post_place_links", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  placeId: integer("place_id").notNull().references(() => venturrPlaces.id, { onDelete: "cascade" }),
  confidence: real("confidence"),
  linkType: text("link_type").default("extracted").notNull(), // "extracted" | "user_added" | "user_confirmed"
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertCollectionSchema = createInsertSchema(collections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
});

export const insertPlaceSchema = createInsertSchema(places).omit({
  id: true,
  createdAt: true,
});

export const insertVenturrPlaceSchema = createInsertSchema(venturrPlaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostPlaceLinkSchema = createInsertSchema(postPlaceLinks).omit({
  id: true,
  createdAt: true,
});

// Plans for organizing venturr places into itineraries
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  status: text("status").default("idle").notNull(), // "idle" | "generating" | "ready" | "failed"
  durationDays: integer("duration_days"),
  content: jsonb("content"), // PlanContent JSON structure
  placesSnapshotHash: text("places_snapshot_hash"), // Hash of place IDs to detect changes
  generatedAt: timestamp("generated_at"),
  // Sharing fields
  isPublic: boolean("is_public").default(false).notNull(),
  shareSlug: text("share_slug"), // Unique URL slug for public sharing
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Plan content structure for type safety
export const planBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "flexible"]).optional(),
  placeIds: z.array(z.number()),
  notes: z.string().optional(),
});

export const planDaySchema = z.object({
  dayNumber: z.number(),
  title: z.string().optional(),
  blocks: z.array(planBlockSchema),
});

export const planContentSchema = z.object({
  overview: z.object({
    summary: z.string(),
    travelTips: z.array(z.string()).optional(),
  }),
  days: z.array(planDaySchema),
  notes: z.string().optional(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type PlanContent = z.infer<typeof planContentSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type PlanBlock = z.infer<typeof planBlockSchema>;

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = z.infer<typeof insertCollectionSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Place = typeof places.$inferSelect;

// Extended Place type for API responses that include VenturrPlace enrichment data
export type PlaceWithEnrichment = Place & {
  venturrPlaceId?: number;
  fsqId?: string | null;
  fsqData?: unknown;
  enrichmentStatus?: string;
  photoUrl?: string | null;
  rating?: number | null;
  website?: string | null;
  phone?: string | null;
  hoursDisplay?: string | null;
  isOpenNow?: boolean | null;
  priceLevel?: number | null;
  addressFull?: string | null;
  // Duration estimation fields
  estimatedDurationMinutes?: number | null;
  spanType?: string | null; // "single" | "multi_block" | "all_day"
  durationSource?: string | null;
  // Source post info for discovery attribution
  sourcePostUrl?: string | null;
  sourcePostSource?: string | null; // "tiktok" | "instagram" | "other"
};
export type InsertPlace = z.infer<typeof insertPlaceSchema>;
export type VenturrPlace = typeof venturrPlaces.$inferSelect;
export type InsertVenturrPlace = z.infer<typeof insertVenturrPlaceSchema>;
export type PostPlaceLink = typeof postPlaceLinks.$inferSelect;
export type InsertPostPlaceLink = z.infer<typeof insertPostPlaceLinkSchema>;
