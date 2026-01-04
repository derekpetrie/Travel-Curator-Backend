import { OpenAI } from "openai";
import { db } from "../server/db";
import { posts, venturrPlaces, postPlaceLinks } from "../shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function geocodePlace(name: string, city: string | null, country: string | null) {
  const searchQuery = [name, city, country].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Venturr App' }
    });
    const results = await response.json();
    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon)
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

async function extractPlacesFromText(text: string) {
  const prompt = `Extract all VISITABLE travel destinations from the following text.

For each place, provide:
- name: The venue name
- city: The city or region
- country: The country
- category: One of: "things to do", "places to eat", "places to stay"
- confidence: A score from 0 to 1

Text: "${text}"

Return your response as a JSON object with a "places" array.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "{}";
  const parsed = JSON.parse(responseText);
  return parsed.places || [];
}

async function main() {
  const postId = parseInt(process.argv[2] || "71");
  
  console.log(`\n=== Fixing extraction for post ${postId} ===\n`);
  
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  
  if (!post) {
    console.error(`Post ${postId} not found`);
    process.exit(1);
  }
  
  console.log("Post:", post.url);
  console.log("Caption:", post.caption?.substring(0, 100));
  
  // Check if places already linked
  const existingLinks = await db.select().from(postPlaceLinks).where(eq(postPlaceLinks.postId, postId));
  if (existingLinks.length > 0) {
    console.log(`\nPost already has ${existingLinks.length} places linked. Skipping.`);
    process.exit(0);
  }
  
  if (!post.caption) {
    console.log("No caption to extract from.");
    process.exit(0);
  }
  
  console.log("\nExtracting places...");
  const extractedPlaces = await extractPlacesFromText(post.caption);
  
  console.log(`Found ${extractedPlaces.length} places`);
  
  for (const place of extractedPlaces) {
    console.log(`\nProcessing: ${place.name}`);
    
    // Geocode
    const coords = await geocodePlace(place.name, place.city, place.country);
    console.log(`  Coordinates: ${coords ? `${coords.lat}, ${coords.lng}` : 'not found'}`);
    
    // Create VenturrPlace
    const [newPlace] = await db.insert(venturrPlaces).values({
      name: place.name,
      categoryPrimary: place.category || 'things to do',
      city: place.city,
      country: place.country,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      geoPrecision: coords ? 'exact' : 'unknown',
      placeStatus: 'active',
      enrichmentStatus: 'not_started',
    }).returning();
    
    console.log(`  Created VenturrPlace: ${newPlace.id}`);
    
    // Create PostPlaceLink
    await db.insert(postPlaceLinks).values({
      postId: post.id,
      placeId: newPlace.id,
      confidence: place.confidence || 0.9,
      linkType: 'extracted',
    });
    
    console.log(`  Linked to post ${post.id}`);
  }
  
  console.log("\nDone!");
  process.exit(0);
}

main().catch(console.error);
