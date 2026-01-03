import { useRef, useCallback, useEffect } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl, { LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';
import { useState } from 'react';
import type { Place } from '@shared/schema';

interface VenturrMapProps {
  places: Place[];
}

export function VenturrMap({ places }: VenturrMapProps) {
  const mapRef = useRef<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const validPlaces = places.filter(p => p.lat !== null && p.lng !== null);

  // Fit bounds when map loads or places change
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || validPlaces.length === 0) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    // Create bounds that include all places
    const bounds = new LngLatBounds();
    validPlaces.forEach(place => {
      if (place.lng && place.lat) {
        bounds.extend([place.lng, place.lat]);
      }
    });

    // Fit the map to show all markers with padding
    map.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 50, right: 50 },
      maxZoom: 15,
      duration: 500,
    });
  }, [mapLoaded, validPlaces]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  // Default view state (will be updated by fitBounds after load)
  const initialViewState = {
    longitude: validPlaces.length > 0 ? validPlaces[0].lng || 0 : 0,
    latitude: validPlaces.length > 0 ? validPlaces[0].lat || 20 : 20,
    zoom: 2,
  };

  const handleMarkerClick = useCallback((place: Place) => {
    setSelectedPlace(place);
    if (mapRef.current && place.lat && place.lng) {
      mapRef.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, []);

  if (validPlaces.length === 0) {
    return (
      <div className="w-full h-full min-h-[400px] bg-muted rounded-xl border border-border flex items-center justify-center">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No places with coordinates yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add posts with travel locations to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border">
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={initialViewState}
        onLoad={handleMapLoad}
        style={{ width: '100%', height: '100%', minHeight: '400px' }}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
      >
        <NavigationControl position="top-right" />
        
        {validPlaces.map((place) => (
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
            <div className="p-2 min-w-[150px]">
              <h3 className="font-bold text-sm text-gray-900">{selectedPlace.name}</h3>
              {selectedPlace.category && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
                  {selectedPlace.category}
                </span>
              )}
              <p className="text-xs text-gray-600 mt-1">
                {selectedPlace.addressFull || [selectedPlace.city, selectedPlace.country].filter(Boolean).join(', ')}
              </p>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

