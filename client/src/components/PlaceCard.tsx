import { MapPin, Navigation, Star, Clock, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { Place, VenturrPlace } from '@shared/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const PLACE_CATEGORIES = [
  'restaurant', 'cafe', 'bar', 'nightlife', 'hotel', 'beach', 'attraction',
  'nature', 'park', 'landmark', 'museum', 'shopping', 'activity', 'wellness',
  'neighborhood', 'skiing', 'theme park', 'other'
] as const;

interface FoursquareEnrichmentData {
  fsqId: string;
  name: string;
  address?: string;
  rating?: number;
  price?: number;
  hours?: {
    display: string;
    openNow: boolean;
  };
  photos: Array<{
    url: string;
    width: number;
    height: number;
  }>;
  website?: string;
  phone?: string;
  description?: string;
  categories: string[];
}

interface EnrichedPlace extends Place {
  fsqId?: string | null;
  fsqData?: FoursquareEnrichmentData | null;
  enrichmentStatus?: string | null;
  linkId?: number;
  venturrPlaceId?: number;
}

interface PlaceCardProps {
  place: EnrichedPlace;
  collectionId?: number;
}

export function PlaceCard({ place, collectionId }: PlaceCardProps) {
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);
  
  const fsqData = place.fsqData as FoursquareEnrichmentData | null;

  const updateCategoryMutation = useMutation({
    mutationFn: async (newCategory: string) => {
      const response = await apiRequest('PATCH', `/api/places/${place.id}/category`, { category: newCategory });
      return response.json();
    },
    onSuccess: () => {
      if (collectionId) {
        queryClient.invalidateQueries({ queryKey: ['places', collectionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['places'] });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      // Use venturrPlaceId for enrichment (the global canonical place ID)
      const placeIdToEnrich = place.venturrPlaceId || place.id;
      const response = await apiRequest('POST', `/api/places/${placeIdToEnrich}/enrich`);
      return response.json();
    },
    onSuccess: () => {
      if (collectionId) {
        queryClient.invalidateQueries({ queryKey: ['places', collectionId] });
      }
      queryClient.invalidateQueries({ queryKey: ['places'] });
    },
  });

  const handleCategoryChange = (newCategory: string) => {
    if (newCategory !== place.category) {
      updateCategoryMutation.mutate(newCategory);
    }
  };

  const isEnriched = place.enrichmentStatus === 'enriched' && fsqData;
  const canEnrich = place.lat && place.lng && place.enrichmentStatus !== 'enriched';

  return (
    <div className="flex flex-col rounded-[14px] bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {isEnriched && fsqData?.photos && fsqData.photos.length > 0 && (
        <div className="relative h-32 w-full overflow-hidden">
          <img 
            src={fsqData.photos[0].url} 
            alt={place.name}
            className="w-full h-full object-cover"
          />
          {fsqData.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              {(fsqData.rating / 2).toFixed(1)}
            </div>
          )}
        </div>
      )}
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            {place.category && (
              <div className="flex items-center gap-1.5 mb-1">
                <Select value={place.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger 
                    className="h-auto px-2 py-0.5 rounded-full bg-coral-500/10 text-coral-500 text-[10px] font-bold uppercase tracking-wider hover:bg-coral-500/20 transition-colors border-none shadow-none w-auto"
                    data-testid={`category-picker-${place.id}`}
                  >
                    <SelectValue>
                      {updateCategoryMutation.isPending ? 'Updating...' : place.category}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {PLACE_CATEGORIES.map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                        data-testid={`category-option-${category}`}
                        className="capitalize"
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <h3 className="font-heading text-lg font-bold text-gunmetal-900">
              {place.name}
            </h3>
          </div>
          
          <div className="flex gap-1">
            {canEnrich && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full"
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                title="Get more details"
                data-testid={`enrich-place-${place.id}`}
              >
                {enrichMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>
            )}
            {place.lat && place.lng && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-gunmetal-500 hover:bg-coral-500/10 hover:text-coral-500 transition-colors"
              >
                <Navigation className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
        
        <div className="flex items-center text-gunmetal-500 text-sm mb-2">
          <MapPin className="w-3.5 h-3.5 mr-1" />
          {[place.city, place.country].filter(Boolean).join(', ') || 'Unknown location'}
        </div>

        {isEnriched && fsqData && (
          <div className="mt-3 pt-3 border-t border-neutral-100">
            {fsqData.hours && (
              <div className="flex items-center gap-2 text-sm mb-2">
                <Clock className="w-3.5 h-3.5 text-gunmetal-500" />
                <span className={fsqData.hours.openNow ? 'text-green-600 font-medium' : 'text-gunmetal-500'}>
                  {fsqData.hours.openNow ? 'Open now' : 'Closed'}
                </span>
                {fsqData.hours.display && (
                  <span className="text-gunmetal-400 text-xs">• {fsqData.hours.display}</span>
                )}
              </div>
            )}
            
            {fsqData.price && (
              <div className="flex items-center gap-2 text-sm mb-2">
                <span className="text-gunmetal-700 font-medium">
                  {'$'.repeat(fsqData.price)}
                  <span className="text-gunmetal-300">{'$'.repeat(4 - fsqData.price)}</span>
                </span>
              </div>
            )}

            {fsqData.categories && fsqData.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {fsqData.categories.slice(0, 3).map((cat, i) => (
                  <span 
                    key={i}
                    className="px-2 py-0.5 bg-neutral-100 text-gunmetal-600 text-xs rounded-full"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            {fsqData.website && (
              <a
                href={fsqData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-coral-500 hover:text-coral-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Visit website
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
