import { useRef, useCallback, useEffect, useState } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl, { LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Star, UtensilsCrossed, Bed } from 'lucide-react';
import type { PlaceWithEnrichment } from '@shared/schema';

// Design system colors
const COLORS = {
  coral: '#F25F5C',
  gunmetal: '#3A4753',
};

interface PlaceMapProps {
  places: PlaceWithEnrichment[];
  onPlaceSelect?: (place: PlaceWithEnrichment) => void;
  selectedPlaceId?: number | null;
  showUserPlacesOnly?: boolean;
}

function getCategoryIcon(category: string | null) {
  switch (category) {
    case 'things to do':
      return Star;
    case 'places to eat':
      return UtensilsCrossed;
    case 'places to stay':
      return Bed;
    default:
      return MapPin;
  }
}

function PlaceMarker({ 
  place, 
  isSelected, 
  isUserPlace = true,
  onClick 
}: { 
  place: PlaceWithEnrichment; 
  isSelected: boolean;
  isUserPlace?: boolean;
  onClick: () => void;
}) {
  const Icon = getCategoryIcon(place.category);
  const outlineColor = isUserPlace ? COLORS.coral : COLORS.gunmetal;
  
  return (
    <div 
      className="cursor-pointer transform transition-transform hover:scale-110"
      style={{ transform: isSelected ? 'scale(1.2)' : undefined }}
      onClick={onClick}
    >
      <div 
        className="rounded-full shadow-lg flex items-center justify-center bg-white"
        style={{ 
          width: 26,
          height: 26,
          border: `2px solid ${outlineColor}`,
          boxShadow: isSelected ? `0 0 0 2px ${outlineColor}40, 0 3px 10px rgba(0,0,0,0.15)` : '0 2px 6px rgba(0,0,0,0.15)'
        }}
      >
        <Icon 
          style={{ color: outlineColor, width: 13, height: 13 }}
          strokeWidth={2.5}
        />
      </div>
    </div>
  );
}

export function PlaceMap({ 
  places, 
  onPlaceSelect, 
  selectedPlaceId,
  showUserPlacesOnly = true 
}: PlaceMapProps) {
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const validPlaces = places.filter(p => p.lat !== null && p.lng !== null);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || validPlaces.length === 0) return;

    const map = mapRef.current.getMap();
    if (!map) return;

    const bounds = new LngLatBounds();
    validPlaces.forEach(place => {
      if (place.lng && place.lat) {
        bounds.extend([place.lng, place.lat]);
      }
    });

    map.fitBounds(bounds, {
      padding: { top: 80, bottom: 120, left: 50, right: 50 },
      maxZoom: 14,
      duration: 800,
    });
  }, [mapLoaded, validPlaces]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleMarkerClick = useCallback((place: PlaceWithEnrichment) => {
    onPlaceSelect?.(place);
    if (mapRef.current && place.lat && place.lng) {
      mapRef.current.flyTo({
        center: [place.lng, place.lat],
        zoom: 14,
        duration: 800,
      });
    }
  }, [onPlaceSelect]);

  const initialViewState = {
    longitude: validPlaces.length > 0 ? validPlaces[0].lng || 0 : 0,
    latitude: validPlaces.length > 0 ? validPlaces[0].lat || 20 : 20,
    zoom: 2,
  };

  if (validPlaces.length === 0) {
    return (
      <div className="w-full h-full min-h-[400px] bg-muted flex items-center justify-center">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No places with coordinates yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add posts with travel locations to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapLib={maplibregl}
      initialViewState={initialViewState}
      onLoad={handleMapLoad}
      style={{ width: '100%', height: '100%' }}
      mapStyle={`https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${import.meta.env.VITE_STADIA_MAPS_API_KEY || ''}`}
    >
      <NavigationControl position="top-right" />

      {validPlaces.map((place) => (
        <Marker
          key={place.id}
          longitude={place.lng!}
          latitude={place.lat!}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            handleMarkerClick(place);
          }}
        >
          <PlaceMarker
            place={place}
            isSelected={selectedPlaceId === place.id}
            isUserPlace={showUserPlacesOnly}
            onClick={() => handleMarkerClick(place)}
          />
        </Marker>
      ))}
    </Map>
  );
}
