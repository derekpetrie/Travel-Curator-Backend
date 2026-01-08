import type { Collection, Post, Place, PlaceWithEnrichment, Plan, PlanContent } from '@shared/schema';

const API_BASE = '/api';

export async function fetchCollections(): Promise<Collection[]> {
  const response = await fetch(`${API_BASE}/collections`);
  if (!response.ok) throw new Error('Failed to fetch collections');
  return response.json();
}

export async function fetchCollection(id: number): Promise<Collection> {
  const response = await fetch(`${API_BASE}/collections/${id}`);
  if (!response.ok) throw new Error('Failed to fetch collection');
  return response.json();
}

export async function createCollection(
  title: string, 
  coverImage?: string | null, 
  coverGradient?: string | null
): Promise<Collection> {
  const response = await fetch(`${API_BASE}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, coverImage, coverGradient }),
  });
  if (!response.ok) throw new Error('Failed to create collection');
  return response.json();
}

export async function deleteCollection(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/collections/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete collection');
}

export async function renameCollection(id: number, title: string): Promise<Collection> {
  const response = await fetch(`${API_BASE}/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to rename collection');
  return response.json();
}

export async function fetchPosts(collectionId: number): Promise<Post[]> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/posts`);
  if (!response.ok) throw new Error('Failed to fetch posts');
  return response.json();
}

export interface AddPostError {
  error: string;
  needsManualCaption?: boolean;
}

export interface AddPostResult {
  post: Post;
  places: Place[];
  extractionMethod: 'text' | 'vision' | null;
  extractionWarning: string | null;
}

export async function addPost(collectionId: number, url: string, manualCaption?: string): Promise<AddPostResult> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, manualCaption }),
  });
  if (!response.ok) {
    const errorData: AddPostError = await response.json();
    const error = new Error(errorData.error) as Error & { needsManualCaption?: boolean };
    error.needsManualCaption = errorData.needsManualCaption;
    throw error;
  }
  return response.json();
}

export async function deletePost(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/posts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete post');
}

export async function fetchPlaces(collectionId: number): Promise<Place[]> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/places`);
  if (!response.ok) throw new Error('Failed to fetch places');
  return response.json();
}

export async function fetchAllPlaces(): Promise<PlaceWithEnrichment[]> {
  const response = await fetch(`${API_BASE}/places`);
  if (!response.ok) throw new Error('Failed to fetch places');
  return response.json();
}

export async function deletePlace(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/places/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete place');
}

export async function updateCollectionCover(
  id: number,
  coverImage: string | null,
  coverGradient: string | null
): Promise<Collection> {
  const response = await fetch(`${API_BASE}/collections/${id}/cover`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coverImage, coverGradient }),
  });
  if (!response.ok) throw new Error('Failed to update collection cover');
  return response.json();
}

export async function generateSummary(id: number): Promise<{ summary: string | null }> {
  const response = await fetch(`${API_BASE}/collections/${id}/summary`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate summary');
  return response.json();
}

// Plan API
export interface PlanResponse {
  plan: Plan | null;
  isStale: boolean;
  currentPlacesHash: string;
}

export async function fetchPlan(collectionId: number): Promise<PlanResponse> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/plan`);
  if (!response.ok) throw new Error('Failed to fetch plan');
  return response.json();
}

export async function generatePlan(collectionId: number, durationDays?: number): Promise<{ plan: Plan; message: string }> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/plan/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ durationDays }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate plan');
  }
  return response.json();
}

export async function deletePlan(collectionId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/plan`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete plan');
}

export async function updatePlan(collectionId: number, content: PlanContent): Promise<Plan> {
  const response = await fetch(`${API_BASE}/collections/${collectionId}/plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error('Failed to update plan');
  return response.json();
}

// Place organization
export async function fetchCollectionsForPlace(placeId: number): Promise<{ id: number; title: string }[]> {
  const response = await fetch(`${API_BASE}/places/${placeId}/collections`);
  if (!response.ok) throw new Error('Failed to fetch collections for place');
  return response.json();
}

export async function copyPlacesToCollection(
  targetCollectionId: number, 
  placeIds: number[]
): Promise<{ copiedCount: number }> {
  const response = await fetch(`${API_BASE}/collections/${targetCollectionId}/copy-places`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeIds }),
  });
  if (!response.ok) throw new Error('Failed to copy places');
  return response.json();
}

// Photo URL utilities
// Checks if a photoUrl is a Google Places reference (not a full URL)
function isGooglePhotoReference(url: string): boolean {
  return url.startsWith('places/') && url.includes('/photos/');
}

// Converts a photo reference or URL to a displayable URL
// - Google photo references are converted to proxy URLs
// - Other URLs (Foursquare, legacy) are returned as-is
export function getPhotoUrl(photoUrl: string | null | undefined, width: number = 400): string | null {
  if (!photoUrl) return null;
  
  // If it's a Google Places reference, use the proxy endpoint
  if (isGooglePhotoReference(photoUrl)) {
    const encoded = btoa(photoUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${API_BASE}/photos/${encoded}?width=${width}`;
  }
  
  // Otherwise return as-is (Foursquare URLs, legacy full URLs)
  return photoUrl;
}
