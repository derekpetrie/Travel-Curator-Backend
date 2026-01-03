import { storage } from "../storage";
import type { VenturrPlace, InsertVenturrPlace } from "@shared/schema";

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'restaurant', 'cafe', 'hotel', 'bar', 'pub', 'inn', 'resort', 'hostel',
  'museum', 'park', 'beach', 'temple', 'shrine', 'church', 'cathedral'
]);

export function normalizeNameForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => !STOPWORDS.has(word) && word.length > 1)
    .sort()
    .join(' ');
}

export function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 1)
  );
}

export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeNameForMatching(name1);
  const norm2 = normalizeNameForMatching(name2);
  
  // If normalized names are empty, fall back to simple comparison
  if (!norm1 || !norm2) {
    return name1.toLowerCase() === name2.toLowerCase() ? 1 : 0;
  }
  
  // Exact normalized match
  if (norm1 === norm2) return 1;
  
  // Token-based Jaccard similarity
  const tokens1 = tokenize(norm1);
  const tokens2 = tokenize(norm2);
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set(Array.from(tokens1).filter(x => tokens2.has(x)));
  const union = new Set([...Array.from(tokens1), ...Array.from(tokens2)]);
  
  const jaccard = intersection.size / union.size;
  
  // Also compute containment (for cases like "Eiffel Tower" vs "Eiffel Tower Paris")
  const containment = Math.max(
    intersection.size / tokens1.size,
    intersection.size / tokens2.size
  );
  
  // Return weighted combination favoring containment for shorter names
  return Math.max(jaccard, containment * 0.9);
}

export function calculateHaversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getMatchRadius(category: string): number {
  // "things to do" gets larger radius (landmarks spread out)
  // "places to eat" and "places to stay" get smaller radius
  if (category === 'things to do') {
    return 500; // 500 meters
  }
  return 200; // 200 meters for eat/stay
}

export interface MatchResult {
  matched: boolean;
  place?: VenturrPlace;
  similarity?: number;
  matchType?: 'google_id' | 'geo_proximity' | 'city_fuzzy';
}

export async function findMatchingVenturrPlace(
  candidate: {
    name: string;
    city: string | null;
    country: string | null;
    category: string;
    lat: number | null;
    lng: number | null;
    googlePlaceId?: string | null;
  },
  similarityThreshold: number = 0.85
): Promise<MatchResult> {
  // Tier 1: Google Place ID match (strongest)
  if (candidate.googlePlaceId) {
    const existingByGoogle = await storage.getVenturrPlaceByGoogleId(candidate.googlePlaceId);
    if (existingByGoogle) {
      return {
        matched: true,
        place: existingByGoogle,
        similarity: 1,
        matchType: 'google_id'
      };
    }
  }

  // Tier 2: Geo-proximity + name similarity (strong)
  if (candidate.lat !== null && candidate.lng !== null) {
    const radius = getMatchRadius(candidate.category);
    const nearbyPlaces = await storage.findNearbyVenturrPlaces(
      candidate.lat,
      candidate.lng,
      radius,
      candidate.category
    );

    for (const existing of nearbyPlaces) {
      if (existing.lat === null || existing.lng === null) continue;
      
      // Calculate distance for threshold adjustment
      const distance = calculateHaversineDistance(
        candidate.lat, candidate.lng,
        existing.lat, existing.lng
      );
      
      // For places at nearly identical coordinates (<50m), be more lenient
      // Just require first word match or containment
      if (distance < 50) {
        const candidateFirstWord = candidate.name.toLowerCase().split(/\s+/)[0];
        const existingFirstWord = existing.name.toLowerCase().split(/\s+/)[0];
        if (candidateFirstWord === existingFirstWord) {
          return {
            matched: true,
            place: existing,
            similarity: 0.9, // High confidence for co-located places
            matchType: 'geo_proximity'
          };
        }
      }
      
      const similarity = calculateNameSimilarity(candidate.name, existing.name);
      if (similarity >= similarityThreshold) {
        return {
          matched: true,
          place: existing,
          similarity,
          matchType: 'geo_proximity'
        };
      }
    }
  }

  // Tier 3: City-based fuzzy match (medium)
  if (candidate.city) {
    const cityPlaces = await storage.findVenturrPlacesByCity(
      candidate.city,
      candidate.country,
      candidate.category
    );

    let bestMatch: { place: VenturrPlace; similarity: number } | null = null;

    for (const existing of cityPlaces) {
      const similarity = calculateNameSimilarity(candidate.name, existing.name);
      if (similarity >= 0.9 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { place: existing, similarity };
      }
    }

    if (bestMatch) {
      return {
        matched: true,
        place: bestMatch.place,
        similarity: bestMatch.similarity,
        matchType: 'city_fuzzy'
      };
    }
  }

  // No match found
  return { matched: false };
}

export async function matchOrCreateVenturrPlace(
  candidate: {
    name: string;
    city: string | null;
    region?: string | null;
    country: string | null;
    category: string;
    lat: number | null;
    lng: number | null;
    confidence?: number;
    googlePlaceId?: string | null;
  }
): Promise<{ place: VenturrPlace; isNew: boolean; matchType?: string }> {
  const matchResult = await findMatchingVenturrPlace({
    name: candidate.name,
    city: candidate.city,
    country: candidate.country,
    category: candidate.category,
    lat: candidate.lat,
    lng: candidate.lng,
    googlePlaceId: candidate.googlePlaceId,
  });

  if (matchResult.matched && matchResult.place) {
    console.log(`[Place Matching] Found existing place: "${matchResult.place.name}" (${matchResult.matchType}, similarity: ${matchResult.similarity?.toFixed(2)})`);
    return {
      place: matchResult.place,
      isNew: false,
      matchType: matchResult.matchType
    };
  }

  // Create new VenturrPlace
  const hasLocation = candidate.lat !== null && candidate.lng !== null;
  const hasCity = !!candidate.city;
  
  // Determine place status and geo precision
  let placeStatus: string = 'active';
  let geoPrecision: string = 'unknown';
  
  if (hasLocation) {
    geoPrecision = 'exact';
  } else if (hasCity) {
    geoPrecision = 'approx';
  } else {
    // No location info - mark for review
    placeStatus = 'needs_review';
  }

  const newPlace: InsertVenturrPlace = {
    name: candidate.name,
    categoryPrimary: candidate.category,
    city: candidate.city,
    region: candidate.region || null,
    country: candidate.country,
    lat: candidate.lat,
    lng: candidate.lng,
    geoPrecision,
    placeStatus,
    googlePlaceId: candidate.googlePlaceId || null,
    enrichmentStatus: 'not_started',
  };

  const created = await storage.createVenturrPlace(newPlace);
  console.log(`[Place Matching] Created new VenturrPlace: "${created.name}" (id: ${created.id}, status: ${placeStatus})`);

  return {
    place: created,
    isNew: true
  };
}
