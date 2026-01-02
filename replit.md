# Venturr - Travel Discovery App

## Overview
Venturr is a mobile-first web application that allows users to save TikTok and Instagram links, automatically extract travel locations using AI, geocode them, and organize everything into "Venturrs" (branded collections) with map views.

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

## Naming Convention (Important for Developers)
The app uses **"Venturr"** as the user-facing brand name, but the backend uses **"collection"** internally:

| User sees | Code/API uses |
|-----------|---------------|
| Venturr | collection |
| Venturrs | collections |
| My Venturrs | /api/collections |

This is intentional to avoid database migrations. When working on the codebase:
- **Frontend components**: Use "Venturr" (VenturrCard, VenturrMap, etc.)
- **Backend/API/Database**: Use "collection" (collections table, /api/collections routes)
- **Types**: The `Collection` type from schema.ts represents a Venturr

## API Endpoints
All endpoints require authentication (except /api/login, /api/logout, /api/callback)

- `GET /api/collections` - List user's Venturrs
- `POST /api/collections` - Create new Venturr
- `GET /api/collections/:id` - Get Venturr details
- `DELETE /api/collections/:id` - Delete Venturr
- `GET /api/collections/:id/posts` - Get posts in Venturr
- `POST /api/collections/:id/posts` - Add post (triggers AI extraction)
- `GET /api/collections/:id/places` - Get places in Venturr

## User Preferences
- Design: Modern iOS-style with coral primary color (#FF385C)
- Typography: Outfit for headings, Inter for body text
- Corners: 0.5rem/8px rounded (not overly bubbly)

## Recent Changes
- 2026-01-02: Added iOS share sheet integration using expo-share-intent
- 2026-01-02: Created ShareIntentProvider and ShareIntentModal for handling shared URLs
- 2026-01-02: Renamed "Collection/Collections" to "Venturr/Venturrs" throughout the app
- 2026-01-02: Updated frontend routes from /collection/:id to /venturr/:id
- 2026-01-02: Renamed component files (VenturrCard, VenturrMap, EditVenturrDrawer, venturr-detail)
- 2024-12-31: Added Replit Auth for user authentication
- 2024-12-31: Added userId to collections for per-user data
- 2024-12-31: Created landing page for logged-out users
- 2024-12-31: Protected all API routes with authentication

## Mobile App (Expo React Native)
The mobile app is set up in the `mobile/` directory using Expo and React Native.

### Mobile App Structure
```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout with auth
│   ├── login.tsx           # Login screen
│   ├── (tabs)/             # Tab navigation
│   │   ├── _layout.tsx     # Tab bar configuration
│   │   ├── index.tsx       # Home screen
│   │   ├── collections.tsx # Saved Posts screen
│   │   └── profile.tsx     # Profile screen
│   └── collection/
│       └── [id].tsx        # Collection detail screen
├── lib/
│   ├── api.ts              # API client for backend
│   └── colors.ts           # Design system colors
└── index.js                # Entry point
```

### Running the Mobile App
To test the mobile app on your iPhone:

1. Install Expo Go app on your iPhone from the App Store
2. In the Replit shell, run: `npx expo start --tunnel`
3. Scan the QR code with your iPhone camera
4. The app will open in Expo Go

### Features Implemented
- Login screen with Replit Auth integration
- Home screen with recent Venturrs and places
- Venturrs list with create/delete functionality
- Venturr detail with posts and places tabs
- Add post modal (paste TikTok/Instagram links)
- Profile screen with user info and logout
- **iOS Share Sheet integration** - Share links directly from TikTok/Instagram to Venturr

### iOS Share Sheet (Requires Custom Build)
The share sheet feature allows users to save TikTok/Instagram links directly from those apps without opening Venturr first. This requires a custom development build (won't work in Expo Go).

**To build and test on your iPhone:**

1. Install EAS CLI locally: `npm install -g eas-cli`
2. Log in to Expo: `eas login`
3. Create a development build: `eas build --profile development --platform ios`
4. Download and install the .ipa file on your iPhone (via TestFlight or ad-hoc)
5. Open TikTok/Instagram, tap Share on a video, select "Venturr" from the share sheet
6. Choose which Venturr to save the link to

**How it works:**
- `expo-share-intent` plugin in app.json enables the iOS Share Extension
- `ShareIntentProvider` in `mobile/lib/share-intent-context.tsx` handles incoming URLs
- `ShareIntentModal` in `mobile/components/ShareIntentModal.tsx` shows the collection picker

### API Connection
The mobile app connects to the same backend at the configured API URL in `app.json`.
For local development, update `extra.apiUrl` in app.json to match your Replit URL.
