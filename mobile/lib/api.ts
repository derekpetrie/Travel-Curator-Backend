import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5000';

class ApiClient {
  private token: string | null = null;

  async setToken(token: string) {
    this.token = token;
    await SecureStore.setItemAsync('auth_token', token);
  }

  async getToken() {
    if (!this.token) {
      this.token = await SecureStore.getItemAsync('auth_token');
    }
    return this.token;
  }

  async clearToken() {
    this.token = null;
    await SecureStore.deleteItemAsync('auth_token');
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

export interface User {
  id: string;
  username: string;
  name: string;
  profileImageUrl?: string;
}

export interface Collection {
  id: number;
  title: string;
  coverImage?: string | null;
  coverGradient?: string | null;
  userId: string;
}

export interface Post {
  id: number;
  url: string;
  platform: string;
  collectionId: number;
  extractedPlaces?: string[];
}

export interface Place {
  id: number;
  name: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  lat?: number | null;
  lng?: number | null;
  collectionId: number;
}

export const authApi = {
  getUser: () => api.get<User>('/api/auth/user'),
  logout: () => api.post('/api/logout'),
};

export const collectionsApi = {
  getAll: () => api.get<Collection[]>('/api/collections'),
  getOne: (id: number) => api.get<Collection>(`/api/collections/${id}`),
  create: (data: { title: string }) => 
    api.post<Collection>('/api/collections', data),
  delete: (id: number) => api.delete(`/api/collections/${id}`),
  getPosts: (id: number) => api.get<Post[]>(`/api/collections/${id}/posts`),
  addPost: (id: number, url: string) => 
    api.post<Post>(`/api/collections/${id}/posts`, { url }),
  getPlaces: (id: number) => api.get<Place[]>(`/api/collections/${id}/places`),
};

export const placesApi = {
  getAll: () => api.get<Place[]>('/api/places'),
};
