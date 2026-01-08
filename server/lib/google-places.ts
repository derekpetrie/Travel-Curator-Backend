import { VenturrPlace } from "@shared/schema";
import { storage } from "../storage";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = "https://places.googleapis.com/v1";

interface GooglePlacePhoto {
  name: string;
  widthPx: number;
  heightPx: number;
}

interface GooglePlaceHours {
  openNow?: boolean;
  weekdayDescriptions?: string[];
}

interface GooglePlace {
  id: string;
  displayName?: {
    text: string;
    languageCode: string;
  };
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: GooglePlaceHours;
  photos?: GooglePlacePhoto[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
  types?: string[];
  primaryType?: string;
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
}

export interface GoogleEnrichmentData {
  googlePlaceId: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  hours?: {
    openNow: boolean;
    weekdayDescriptions?: string[];
  };
  photoUrl?: string;
  website?: string;
  phone?: string;
  types: string[];
}

function getHeaders(fieldMask: string): Record<string, string> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
    "X-Goog-FieldMask": fieldMask,
  };
}

function parsePriceLevel(priceLevel?: string): number | undefined {
  if (!priceLevel) return undefined;
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[priceLevel];
}

export function buildPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  }
  return `${BASE_URL}/${photoReference}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_PLACES_API_KEY}`;
}

export function isGooglePhotoReference(url: string): boolean {
  return url.startsWith('places/') && url.includes('/photos/');
}

export async function searchNearbyPlaces(
  query: string,
  lat: number,
  lng: number,
  radiusMeters: number = 500
): Promise<GooglePlace[]> {
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.types",
  ].join(",");

  const response = await fetch(`${BASE_URL}/places:searchText`, {
    method: "POST",
    headers: getHeaders(fieldMask),
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: radiusMeters,
        },
      },
      maxResultCount: 5,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Google Places] Search failed: ${response.status} - ${error}`);
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data: GoogleSearchResponse = await response.json();
  return data.places || [];
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
  const fieldMask = [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "rating",
    "userRatingCount",
    "priceLevel",
    "currentOpeningHours",
    "photos",
    "websiteUri",
    "internationalPhoneNumber",
    "types",
    "primaryType",
  ].join(",");

  const response = await fetch(`${BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: getHeaders(fieldMask),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    console.error(`[Google Places] Get details failed: ${response.status} - ${error}`);
    throw new Error(`Google Places API error: ${response.status}`);
  }

  return await response.json();
}

export async function findAndEnrichPlace(
  place: VenturrPlace
): Promise<GoogleEnrichmentData | null> {
  if (!place.lat || !place.lng) {
    console.log(`[Google Places] Skipping place without coordinates: ${place.name}`);
    return null;
  }

  try {
    // First try with tight radius (1km) for accurate matches
    let searchResults = await searchNearbyPlaces(
      place.name,
      place.lat,
      place.lng,
      1000
    );

    // If no results, retry with much larger radius (50km) to handle inaccurate geocoding
    if (searchResults.length === 0) {
      console.log(`[Google Places] No results within 1km for "${place.name}", retrying with 50km radius...`);
      searchResults = await searchNearbyPlaces(
        place.name,
        place.lat,
        place.lng,
        50000
      );
    }

    if (searchResults.length === 0) {
      console.log(`[Google Places] No results found for: ${place.name} even with expanded search`);
      return null;
    }

    const bestMatch = searchResults[0];
    console.log(`[Google Places] Found match: "${bestMatch.displayName?.text}" for "${place.name}"`);

    const details = await getPlaceDetails(bestMatch.id);
    if (!details) {
      return null;
    }

    let photoUrl: string | undefined;
    if (details.photos && details.photos.length > 0) {
      photoUrl = details.photos[0].name;
    }

    const enrichmentData: GoogleEnrichmentData = {
      googlePlaceId: details.id,
      name: details.displayName?.text || place.name,
      address: details.formattedAddress,
      lat: details.location?.latitude,
      lng: details.location?.longitude,
      rating: details.rating,
      userRatingCount: details.userRatingCount,
      priceLevel: parsePriceLevel(details.priceLevel),
      hours: details.currentOpeningHours
        ? {
            openNow: details.currentOpeningHours.openNow || false,
            weekdayDescriptions: details.currentOpeningHours.weekdayDescriptions,
          }
        : undefined,
      photoUrl,
      website: details.websiteUri,
      phone: details.internationalPhoneNumber,
      types: details.types || [],
    };

    return enrichmentData;
  } catch (error) {
    console.error(`[Google Places] Error enriching place ${place.name}:`, error);
    return null;
  }
}

const ENRICHMENT_CACHE_DAYS = 7;

export async function enrichPlaceWithGoogle(placeId: number): Promise<boolean> {
  const place = await storage.getVenturrPlace(placeId);
  if (!place) {
    console.log(`[Google Places] Place not found: ${placeId}`);
    return false;
  }

  if (place.googleFetchedAt) {
    const cacheAge = Date.now() - new Date(place.googleFetchedAt).getTime();
    const cacheDays = cacheAge / (1000 * 60 * 60 * 24);
    if (cacheDays < ENRICHMENT_CACHE_DAYS && place.enrichmentStatus === 'enriched') {
      console.log(`[Google Places] Using cached data for "${place.name}" (${cacheDays.toFixed(1)} days old)`);
      return true;
    }
  }

  try {
    const enrichmentData = await findAndEnrichPlace(place);

    if (!enrichmentData) {
      return false;
    }

    const hoursDisplay = enrichmentData.hours?.weekdayDescriptions?.join(" | ") || null;

    await storage.updateVenturrPlace(placeId, {
      googlePlaceId: enrichmentData.googlePlaceId,
      googleData: enrichmentData,
      googleFetchedAt: new Date(),
      lat: enrichmentData.lat ?? place.lat,
      lng: enrichmentData.lng ?? place.lng,
      photoUrl: enrichmentData.photoUrl ?? place.photoUrl,
      rating: enrichmentData.rating ?? place.rating,
      website: enrichmentData.website ?? place.website,
      phone: enrichmentData.phone ?? place.phone,
      hoursDisplay: hoursDisplay ?? place.hoursDisplay,
      isOpenNow: enrichmentData.hours?.openNow ?? place.isOpenNow,
      priceLevel: enrichmentData.priceLevel ?? place.priceLevel,
      addressFull: enrichmentData.address ?? place.addressFull,
      enrichmentStatus: 'enriched'
    });

    console.log(`[Google Places] Successfully enriched "${place.name}" with photo, rating, hours, etc.`);
    return true;
  } catch (error) {
    console.error(`[Google Places] Error enriching place ${place.name}:`, error);
    return false;
  }
}
