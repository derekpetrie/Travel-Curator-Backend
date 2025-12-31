import tokyoImg from '@assets/generated_images/cinematic_photo_of_tokyo_street_at_night.png';
import amalfiImg from '@assets/generated_images/sunny_amalfi_coast_landscape.png';
import parisImg from '@assets/generated_images/cozy_parisian_cafe_street_view.png';

export type Source = 'tiktok' | 'instagram';

export interface Post {
  id: string;
  source: Source;
  url: string;
  thumbnailUrl: string;
  caption: string;
  author: string;
}

export interface Place {
  id: string;
  name: string;
  category: string;
  city: string;
  country: string;
  rating: number;
  lat: number;
  lng: number;
  postIds: string[];
}

export interface Collection {
  id: string;
  title: string;
  thumbnail: string;
  itemCount: number;
  createdAt: string;
  posts: Post[];
  places: Place[];
}

export const MOCK_COLLECTIONS: Collection[] = [
  {
    id: '1',
    title: 'Tokyo Eats 🍜',
    thumbnail: tokyoImg,
    itemCount: 12,
    createdAt: '2025-01-15',
    posts: [
      {
        id: 'p1',
        source: 'tiktok',
        url: '#',
        thumbnailUrl: 'https://images.unsplash.com/photo-1552604617-0113ddc4585c?w=500&q=80',
        caption: 'Hidden ramen spot in Shinjuku! 🍜 #tokyo #ramen',
        author: '@tokyofoodie'
      },
      {
        id: 'p2',
        source: 'instagram',
        url: '#',
        thumbnailUrl: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=500&q=80',
        caption: 'The best matcha latte I have ever had... 🍵',
        author: '@matcha_lover'
      }
    ],
    places: [
      {
        id: 'pl1',
        name: 'Omoide Yokocho',
        category: 'Food & Drink',
        city: 'Tokyo',
        country: 'Japan',
        rating: 4.5,
        lat: 35.6929,
        lng: 139.6997,
        postIds: ['p1']
      },
      {
        id: 'pl2',
        name: 'Ichiran Ramen',
        category: 'Restaurant',
        city: 'Tokyo',
        country: 'Japan',
        rating: 4.8,
        lat: 35.6916,
        lng: 139.7046,
        postIds: ['p1']
      }
    ]
  },
  {
    id: '2',
    title: 'Amalfi Coast Summer 🍋',
    thumbnail: amalfiImg,
    itemCount: 8,
    createdAt: '2025-02-01',
    posts: [],
    places: []
  },
  {
    id: '3',
    title: 'Paris Cafe Hopping 🥐',
    thumbnail: parisImg,
    itemCount: 15,
    createdAt: '2024-12-10',
    posts: [],
    places: []
  }
];
