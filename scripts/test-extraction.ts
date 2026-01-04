import { OpenAI } from "openai";
import { db } from "../server/db";
import { posts, venturrPlaces, postPlaceLinks } from "../shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function extractPlacesFromText(text: string) {
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

Return your response as a JSON object with a "places" array of objects with keys: name, city, country, category, confidence. If no places are found, return {"places": []}.`;

  console.log("[Text Extraction] Calling OpenAI with caption length:", text.length);
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0].message.content || "{}";
    console.log("[Text Extraction] OpenAI response:", responseText);
    const parsed = JSON.parse(responseText);
    const places = parsed.places || parsed.result || parsed.results || (Array.isArray(parsed) ? parsed : []);
    console.log("[Text Extraction] Parsed places:", places.length);
    return places;
  } catch (error) {
    console.error("[Text Extraction] Error:", error);
    return [];
  }
}

async function main() {
  const postId = parseInt(process.argv[2] || "71");
  
  console.log(`\n=== Testing extraction for post ${postId} ===\n`);
  
  // Get the post
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  
  if (!post) {
    console.error(`Post ${postId} not found`);
    process.exit(1);
  }
  
  console.log("Post found:");
  console.log("  URL:", post.url);
  console.log("  Caption:", post.caption?.substring(0, 200) || "(no caption)");
  console.log("  Thumbnail:", post.thumbnailUrl ? "present" : "missing");
  console.log();
  
  // Check if places already linked
  const existingLinks = await db.select().from(postPlaceLinks).where(eq(postPlaceLinks.postId, postId));
  console.log(`Existing place links: ${existingLinks.length}`);
  
  if (existingLinks.length > 0) {
    for (const link of existingLinks) {
      const [place] = await db.select().from(venturrPlaces).where(eq(venturrPlaces.id, link.placeId));
      console.log(`  - ${place?.name || "unknown"} (id: ${link.placeId})`);
    }
  }
  console.log();
  
  // Now test extraction
  if (!post.caption) {
    console.log("No caption to extract from.");
    process.exit(0);
  }
  
  console.log("Testing text extraction...");
  const extractedPlaces = await extractPlacesFromText(post.caption);
  
  console.log(`\nExtracted ${extractedPlaces.length} places:`);
  for (const place of extractedPlaces) {
    console.log(`  - ${place.name} (${place.city}, ${place.country}) [${place.category}] confidence: ${place.confidence}`);
  }
  
  process.exit(0);
}

main().catch(console.error);
