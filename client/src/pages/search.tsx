import { TabBar } from '@/components/TabBar';
import { Compass, MapPin, List, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllPlaces, fetchCollections } from '@/lib/api';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl, { LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Place } from '@shared/schema';
import { cn } from '@/lib/utils';

export default function Explore() {
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const mapRef = useRef<any>(null);

  const { data: places = [], isLoading } = useQuery({
    queryKey: ['all-places'],
    queryFn: fetchAllPlaces,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const validPlaces = places.filter(p => p.lat !== null && p.lng !== null);

  const filteredPlaces = validPlaces.filter(place => {
    const matchesSearch = !searchQuery || 
      place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      place.country?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !categoryFilter || place.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(validPlaces.map(p => p.category).filter(Boolean))) as string[];

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || filteredPlaces.length === 0) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    const bounds = new LngLatBounds();
    filteredPlaces.forEach(place => {
      if (place.lng && place.lat) {
        bounds.extend([place.lng, place.lat]);
      }
    });

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 50, right: 50 },
      maxZoom: 12,
      duration: 800,
    });
  }, [mapLoaded, filteredPlaces]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const initialViewState = {
    longitude: 0,
    latitude: 20,
    zoom: 1.5,
  };

  const handleMarkerClick = useCallback((place: Place) => {
    setSelectedPlace(place);
    if (mapRef.current && place.lat && place.lng) {
      mapRef.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 12,
        duration: 800,
      });
    }
  }, []);

  const getCollectionName = (collectionId: number) => {
    const collection = collections.find(c => c.id === collectionId);
    return collection?.title || 'Unknown';
  };

  return (
    <div className="min-h-screen pb-24 bg-background safe-top flex flex-col">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-6 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-heading text-3xl font-extrabold text-foreground flex items-center gap-2">
            <Compass className="w-7 h-7 text-primary" />
            Explore
          </h1>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setView('map')}
              className={cn(
                "p-2 rounded-md transition-colors",
                view === 'map' ? "bg-background shadow-sm" : "hover:bg-background/50"
              )}
              data-testid="button-view-map"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                "p-2 rounded-md transition-colors",
                view === 'list' ? "bg-background shadow-sm" : "hover:bg-background/50"
              )}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <MapPin className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search places..."
            className="w-full h-12 pl-11 pr-4 rounded-lg bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none font-medium text-foreground placeholder:text-muted-foreground/70"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all",
                categoryFilter === null
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              data-testid="button-filter-all"
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setCategoryFilter(categoryFilter === category ? null : category)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all",
                  categoryFilter === category
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
                data-testid={`button-filter-${category}`}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : validPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <MapPin className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No places yet</h2>
            <p className="text-muted-foreground max-w-xs">
              Add TikTok or Instagram links to your Venturrs and we'll extract the travel locations automatically.
            </p>
          </div>
        ) : view === 'map' ? (
          <div className="absolute inset-0">
            <Map
              ref={mapRef}
              mapLib={maplibregl}
              initialViewState={initialViewState}
              onLoad={handleMapLoad}
              style={{ width: '100%', height: '100%' }}
              mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
            >
              <NavigationControl position="top-right" />

              {filteredPlaces.map((place) => (
                <Marker
                  key={place.id}
                  longitude={place.lng!}
                  latitude={place.lat!}
                  anchor="bottom"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    handleMarkerClick(place);
                  }}
                >
                  <div className="cursor-pointer transform hover:scale-110 transition-transform">
                    <div className="w-8 h-8 bg-primary rounded-full shadow-lg flex items-center justify-center text-white border-2 border-white">
                      <MapPin className="w-4 h-4" />
                    </div>
                  </div>
                </Marker>
              ))}

              {selectedPlace && selectedPlace.lat && selectedPlace.lng && (
                <Popup
                  longitude={selectedPlace.lng}
                  latitude={selectedPlace.lat}
                  anchor="bottom"
                  offset={[0, -35]}
                  closeOnClick={false}
                  onClose={() => setSelectedPlace(null)}
                  className="map-popup"
                >
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-bold text-sm text-gray-900">{selectedPlace.name}</h3>
                    {selectedPlace.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                        {selectedPlace.category}
                      </span>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {[selectedPlace.city, selectedPlace.country].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      From: {getCollectionName(selectedPlace.collectionId)}
                    </p>
                  </div>
                </Popup>
              )}
            </Map>

            <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 text-center border border-border">
              <p className="text-sm font-medium">
                {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'} 
                {searchQuery || categoryFilter ? ' matching filters' : ' saved'}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            {filteredPlaces.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No places match your filters</p>
            ) : (
              filteredPlaces.map((place) => (
                <div
                  key={place.id}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg"
                  data-testid={`place-card-${place.id}`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground truncate">{place.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {[place.city, place.country].filter(Boolean).join(', ')}
                    </p>
                    {place.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                        {place.category}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {getCollectionName(place.collectionId)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
