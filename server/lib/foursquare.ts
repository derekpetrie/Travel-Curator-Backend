import { VenturrPlace } from "@shared/schema";
import { storage } from "../storage";

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const BASE_URL = "https://places-api.foursquare.com";

interface FoursquarePhoto {
  id: string;
  created_at: string;
  prefix: string;
  suffix: string;
  width: number;
  height: number;
}

interface FoursquareHours {
  display: string;
  is_local_holiday: boolean;
  open_now: boolean;
  regular: Array<{
    close: string;
    day: number;
    open: string;
  }>;
}

interface FoursquarePlace {
  fsq_place_id: string;
  fsq_id?: string; // Legacy field, may still be present
  name: string;
  location: {
    address?: string;
    address_extended?: string;
    country?: string;
    cross_street?: string;
    formatted_address?: string;
    locality?: string;
    postcode?: string;
    region?: string;
  };
  latitude?: number;
  longitude?: number;
  geocodes?: {
    main?: {
      latitude: number;
      longitude: number;
    };
  };
  categories?: Array<{
    id: string | number;
    name: string;
    short_name?: string;
    plural_name?: string;
    icon?: {
      prefix: string;
      suffix: string;
    };
  }>;
  distance?: number;
  rating?: number;
  price?: number;
  hours?: FoursquareHours;
  photos?: FoursquarePhoto[];
  website?: string;
  tel?: string;
  description?: string;
  tastes?: string[];
  popularity?: number;
}

interface FoursquareSearchResponse {
  results: FoursquarePlace[];
}

export interface FoursquareEnrichmentData {
  fsqId: string;
  name: string;
  address?: string;
  rating?: number;
  price?: number;
  hours?: {
    display: string;
    openNow: boolean;
    regular?: Array<{
      close: string;
      day: number;
      open: string;
    }>;
  };
  photos: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  website?: string;
  phone?: string;
  description?: string;
  categories: string[];
  popularity?: number;
}

function getHeaders(): Record<string, string> {
  if (!FOURSQUARE_API_KEY) {
    throw new Error("FOURSQUARE_API_KEY is not configured");
  }
  return {
    Accept: "application/json",
    Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
    "X-Places-Api-Version": "2025-06-17",
  };
}

function buildPhotoUrl(photo: FoursquarePhoto, size: string = "300x300"): string {
  return `${photo.prefix}${size}${photo.suffix}`;
}

export async function searchPlaces(
  query: string,
  lat: number,
  lng: number,
  radius: number = 500,
  limit: number = 5
): Promise<FoursquarePlace[]> {
  const params = new URLSearchParams({
    query,
    ll: `${lat},${lng}`,
    radius: radius.toString(),
    limit: limit.toString(),
    fields: "fsq_place_id,name,location,latitude,longitude,categories,distance,rating,price",
  });

  const response = await fetch(`${BASE_URL}/places/search?${params}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Foursquare] Search failed: ${response.status} - ${error}`);
    throw new Error(`Foursquare API error: ${response.status}`);
  }

  const data: FoursquareSearchResponse = await response.json();
  return data.results;
}

export async function getPlaceDetails(fsqId: string): Promise<FoursquarePlace | null> {
  const fields = [
    "fsq_place_id",
    "name",
    "location",
    "latitude",
    "longitude",
    "categories",
    "rating",
    "price",
    "hours",
    "photos",
    "website",
    "tel",
    "description",
    "tastes",
    "popularity",
  ].join(",");

  const response = await fetch(`${BASE_URL}/places/${fsqId}?fields=${fields}`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    console.error(`[Foursquare] Get details failed: ${response.status} - ${error}`);
    throw new Error(`Foursquare API error: ${response.status}`);
  }

  return await response.json();
}

export async function findAndEnrichPlace(
  place: VenturrPlace
): Promise<FoursquareEnrichmentData | null> {
  if (!place.lat || !place.lng) {
    console.log(`[Foursquare] Skipping place without coordinates: ${place.name}`);
    return null;
  }

  try {
    const searchResults = await searchPlaces(
      place.name,
      place.lat,
      place.lng,
      500,
      3
    );

    if (searchResults.length === 0) {
      console.log(`[Foursquare] No results found for: ${place.name}`);
      return null;
    }

    const bestMatch = searchResults[0];
    const bestMatchId = bestMatch.fsq_place_id || bestMatch.fsq_id;
    console.log(`[Foursquare] Found match: "${bestMatch.name}" for "${place.name}" (distance: ${bestMatch.distance}m)`);

    if (!bestMatchId) {
      console.log(`[Foursquare] No place ID found for: ${place.name}`);
      return null;
    }

    const details = await getPlaceDetails(bestMatchId);
    if (!details) {
      return null;
    }

    const detailsId = details.fsq_place_id || details.fsq_id || bestMatchId;
    const enrichmentData: FoursquareEnrichmentData = {
      fsqId: detailsId,
      name: details.name,
      address: details.location?.formatted_address,
      rating: details.rating,
      price: details.price,
      hours: details.hours
        ? {
            display: details.hours.display,
            openNow: details.hours.open_now,
            regular: details.hours.regular,
          }
        : undefined,
      photos: (details.photos || []).slice(0, 5).map((photo) => ({
        url: buildPhotoUrl(photo, "original"),
        width: photo.width,
        height: photo.height,
      })),
      website: details.website,
      phone: details.tel,
      description: details.description,
      categories: (details.categories || []).map((c) => c.name),
      popularity: details.popularity,
    };

    return enrichmentData;
  } catch (error) {
    console.error(`[Foursquare] Error enriching place ${place.name}:`, error);
    return null;
  }
}

const ENRICHMENT_CACHE_DAYS = 7;

export async function enrichPlaceAndSave(placeId: number): Promise<boolean> {
  const place = await storage.getVenturrPlace(placeId);
  if (!place) {
    console.log(`[Foursquare] Place not found: ${placeId}`);
    return false;
  }

  // Check if recently enriched (cache)
  if (place.fsqFetchedAt) {
    const cacheAge = Date.now() - new Date(place.fsqFetchedAt).getTime();
    const cacheDays = cacheAge / (1000 * 60 * 60 * 24);
    if (cacheDays < ENRICHMENT_CACHE_DAYS && place.enrichmentStatus === 'enriched') {
      console.log(`[Foursquare] Using cached data for "${place.name}" (${cacheDays.toFixed(1)} days old)`);
      return true;
    }
  }

  // Mark as pending
  await storage.updateVenturrPlace(placeId, { enrichmentStatus: 'pending' });

  try {
    const enrichmentData = await findAndEnrichPlace(place);

    if (!enrichmentData) {
      await storage.updateVenturrPlace(placeId, { 
        enrichmentStatus: 'failed',
        fsqFetchedAt: new Date()
      });
      return false;
    }

    // Extract first photo URL if available
    const photoUrl = enrichmentData.photos.length > 0 ? enrichmentData.photos[0].url : null;

    // Save flattened fields + JSON blob
    await storage.updateVenturrPlace(placeId, {
      fsqId: enrichmentData.fsqId,
      fsqData: enrichmentData,
      fsqFetchedAt: new Date(),
      photoUrl,
      rating: enrichmentData.rating ?? null,
      website: enrichmentData.website ?? null,
      phone: enrichmentData.phone ?? null,
      hoursDisplay: enrichmentData.hours?.display ?? null,
      isOpenNow: enrichmentData.hours?.openNow ?? null,
      priceLevel: enrichmentData.price ?? null,
      addressFull: enrichmentData.address ?? place.addressFull,
      enrichmentStatus: 'enriched'
    });

    console.log(`[Foursquare] Successfully enriched "${place.name}" with photo, rating, hours, etc.`);
    return true;
  } catch (error) {
    console.error(`[Foursquare] Error enriching place ${place.name}:`, error);
    await storage.updateVenturrPlace(placeId, { 
      enrichmentStatus: 'failed',
      fsqFetchedAt: new Date()
    });
    return false;
  }
}

export async function enrichPlaceAsync(placeId: number): Promise<void> {
  // Fire and forget - don't block the response
  setImmediate(async () => {
    try {
      // Try Foursquare first
      const fsqSuccess = await enrichPlaceAndSave(placeId);
      if (fsqSuccess) {
        console.log(`[Enrichment] Foursquare succeeded for place ${placeId}`);
      }
      
      // Always try Google Places too - it has better coordinates and additional data
      try {
        const { enrichPlaceWithGoogle } = await import('./google-places');
        const googleSuccess = await enrichPlaceWithGoogle(placeId);
        if (googleSuccess) {
          console.log(`[Enrichment] Google Places succeeded for place ${placeId}`);
        } else if (!fsqSuccess) {
          console.log(`[Enrichment] Both Foursquare and Google Places failed for place ${placeId}`);
        }
      } catch (googleError) {
        console.error(`[Enrichment] Google Places error for place ${placeId}:`, googleError);
      }
    } catch (error) {
      console.error(`[Foursquare] Async enrichment failed for place ${placeId}:`, error);
    }
  });
}
