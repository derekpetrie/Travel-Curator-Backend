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
- `GET /api/collections/:id/plan` - Get AI-generated travel plan (with staleness detection)
- `POST /api/collections/:id/plan/generate` - Generate or regenerate travel plan (async)
- `PATCH /api/collections/:id/plan` - Update plan content (edit blocks, titles, notes)
- `POST /api/collections/:id/plan/share` - Toggle plan sharing (isPublic, generates shareSlug)
- `DELETE /api/collections/:id/plan` - Delete travel plan
- `GET /api/plans/:slug` - Get public plan by share slug (no auth required)
- `POST /api/collections/:id/share` - Toggle Venturr sharing (isPublic, generates shareSlug)
- `GET /api/v/:slug` - Get public Venturr by share slug (no auth required)
- `GET /api/places/:id/collections` - Get which Venturrs contain a specific place
- `POST /api/collections/:id/copy-places` - Copy places (and their posts) to a collection

## Venturr Design System v1.0

### Brand Personality
Quietly smart, calm, modern, intentional, trustworthy. Think: Pinterest + Notion + maps, not Expedia or TikTok.

### Color Palette
```css
/* Primary */
--coral-500: #F25F5C;      /* Primary CTAs, brand accent */

/* Gunmetal - Text hierarchy */
--gunmetal-900: #1F2933;   /* Headlines, primary text */
--gunmetal-700: #3A4753;   /* Secondary text */
--gunmetal-500: #6B7280;   /* Metadata, icons */

/* Neutrals - Layout */
--neutral-50: #F8FAFC;     /* App background */
--neutral-0: #FFFFFF;      /* Cards */
--neutral-200: #E2E8F0;    /* Borders */

/* Semantic */
--success: #4CAF93;
--warning: #F4B740;
--info: #4C82F7;
```

### Typography
- Font: Inter (system fallback: -apple-system, SF Pro)
- Headings: 600 weight
- Body: 400 weight
- No emojis in core UI

### Spacing & Radius
- radius-md: 14px (primary cards)
- radius-lg: 18px (large cards)
- shadow-sm: 0 4px 14px rgba(31,41,51,0.08)

### Design Guidelines
- Coral guides attention (CTAs, active states, highlights)
- Never use coral for body text
- Cards are the core metaphor (white on neutral background)
- Be transparent about AI (label AI-suggested content)

### UI Component Policy (Radix-First)
Always use Radix UI primitives (via `client/src/components/ui/` wrappers) before implementing custom solutions:

1. **Check existing components first**: Look in `client/src/components/ui/` for shadcn/Radix wrappers
2. **Extend via composition**: If a Radix component needs customization, wrap/extend it rather than forking
3. **Document exceptions**: When Radix cannot handle a requirement, document why in a code comment
4. **Available primitives**: ScrollArea, Dialog, Drawer, Tabs, Select, Popover, Tooltip, etc.

Examples:
- Horizontal scrolling → Use `ScrollArea` with `ScrollBar orientation="horizontal"`
- Modal dialogs → Use `Dialog` or `Drawer` (from vaul)
- Tab navigation → Use `Tabs` from Radix
- Dropdowns → Use `Select` or `DropdownMenu`

## Recent Changes
- 2026-01-08: Venturr sharing with public links (/v/:slug) and share dialog with copy-to-clipboard
- 2026-01-08: Soft delete for Venturrs - marks deletedAt instead of hard delete, preserving posts/places
- 2026-01-08: Discovery attribution in PlaceDrawer - links to original TikTok/Instagram post
- 2026-01-08: Posts and places now owned by userId (independent of collections)
- 2026-01-06: Removed multi-select from Explore page (single-place add flow)
- 2026-01-06: PlaceDrawer shows which Venturrs a place belongs to
- 2026-01-06: Added copy-places API for cross-Venturr place organization (copies posts too)
- 2026-01-05: Added plan editing with inline block title, notes, and time of day changes
- 2026-01-05: Added plan sharing with public links (/plan/:slug) and copy-to-clipboard
- 2026-01-05: Added public plan view page (no auth required) at /plan/:slug
- 2026-01-05: Added Plan tab to Venturr detail with AI-generated day-by-day itineraries
- 2026-01-05: Restructured Venturr detail tabs to Posts | Plan | Places with List/Map toggle
- 2026-01-05: Added plan staleness detection (shows banner when places change after plan generation)
- 2026-01-05: Added plans table schema with JSON content storage for itinerary data
- 2026-01-03: Automatic place enrichment on creation (no manual sparkle button needed)
- 2026-01-03: Flattened Foursquare fields in VenturrPlace schema (photoUrl, rating, website, phone, hoursDisplay, isOpenNow, priceLevel)
- 2026-01-03: Redesigned PlaceCard with compact horizontal layout (photo thumbnail, rating, hours, expandable details)
- 2026-01-03: Foursquare Places API integration for place enrichment (photos, ratings, hours, price)
- 2026-01-03: Updated to new Foursquare API (places-api.foursquare.com with Bearer auth)
- 2026-01-02: Applied Venturr Design System v1.0 (new color palette, typography, app icon)
- 2026-01-02: Renamed Search to Explore with map view showing all saved places
- 2026-01-02: Added /api/places endpoint for fetching all user places across Venturrs
- 2026-01-02: Added Explore tab to mobile app with place list and filters
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
