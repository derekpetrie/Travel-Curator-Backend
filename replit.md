# Venturr - Travel Collection App

## Overview
Venturr is a mobile-first web application that allows users to save TikTok and Instagram links, automatically extract travel locations using AI, geocode them, and organize everything into visual collections with map views.

## Current State
The application has a production-ready backend with:
- User authentication (Google, GitHub, Apple, email)
- PostgreSQL database with per-user data isolation
- AI-powered place extraction from social media posts
- Geocoding via OpenStreetMap

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Radix UI
- **Backend**: Express.js, PostgreSQL, Drizzle ORM
- **AI Integration**: OpenAI GPT-4o-mini (via Replit AI Integrations)
- **Authentication**: Replit Auth (OIDC)
- **Geocoding**: OpenStreetMap Nominatim

## Project Architecture
```
client/                 # React frontend
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Route pages
│   ├── hooks/          # Custom React hooks
│   └── lib/            # Utilities and API client
server/                 # Express backend
├── routes.ts           # API endpoints
├── storage.ts          # Database operations
├── db.ts               # Database connection
└── replit_integrations/# Auth and AI integrations
shared/                 # Shared types and schemas
├── schema.ts           # Drizzle database schemas
└── models/             # Additional models
```

## API Endpoints
All endpoints require authentication (except /api/login, /api/logout, /api/callback)

- `GET /api/collections` - List user's collections
- `POST /api/collections` - Create new collection
- `GET /api/collections/:id` - Get collection details
- `DELETE /api/collections/:id` - Delete collection
- `GET /api/collections/:id/posts` - Get posts in collection
- `POST /api/collections/:id/posts` - Add post (triggers AI extraction)
- `GET /api/collections/:id/places` - Get places in collection

## User Preferences
- Design: Modern iOS-style with coral primary color (#FF385C)
- Typography: Outfit for headings, Inter for body text
- Corners: 0.5rem/8px rounded (not overly bubbly)

## Recent Changes
- 2024-12-31: Added Replit Auth for user authentication
- 2024-12-31: Added userId to collections for per-user data
- 2024-12-31: Created landing page for logged-out users
- 2024-12-31: Protected all API routes with authentication

## Next Steps for Mobile (Expo)
To create a native mobile app, the frontend needs to be converted to React Native using Expo. This involves:
1. Setting up Expo project structure
2. Converting React web components to React Native
3. Adding mobile navigation (tabs, stack)
4. Testing with Expo Go on physical device
