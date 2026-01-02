import type { Collection, Post, Place } from '@shared/schema';

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

export async function fetchAllPlaces(): Promise<Place[]> {
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
