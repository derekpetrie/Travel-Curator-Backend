import { MapPin, Navigation, Star, Clock, Phone, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { Place } from '@shared/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PLACE_CATEGORIES = [
  'things to do',
  'places to eat', 
  'places to stay'
] as const;

interface EnrichedPlace extends Place {
  fsqId?: string | null;
  fsqData?: unknown;
  enrichmentStatus?: string | null;
  linkId?: number;
  venturrPlaceId?: number;
  photoUrl?: string | null;
  rating?: number | null;
  website?: string | null;
  phone?: string | null;
  hoursDisplay?: string | null;
  isOpenNow?: boolean | null;
  priceLevel?: number | null;
  addressFull?: string | null;
}

interface PlaceCardProps {
  place: EnrichedPlace;
  collectionId?: number;
}

function formatPhoneForDisplay(phone: string): string {
  return phone.replace(/^\+1\s?/, '').replace(/[^\d\s()-]/g, '');
}

function formatWebsiteForDisplay(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

export function PlaceCard({ place, collectionId }: PlaceCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

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

  const handleCategoryChange = (newCategory: string) => {
    if (newCategory !== place.category) {
      updateCategoryMutation.mutate(newCategory);
    }
  };

  const hasDetails = place.website || place.phone || place.hoursDisplay;
  const location = place.addressFull || [place.city, place.country].filter(Boolean).join(', ') || 'Unknown location';

  return (
    <div 
      className="rounded-[14px] bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      data-testid={`place-card-${place.id}`}
    >
      <div className="flex">
        {place.photoUrl ? (
          <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
            <img 
              src={place.photoUrl} 
              alt={place.name}
              className="w-full h-full object-cover"
              data-testid={`place-photo-${place.id}`}
            />
          </div>
        ) : (
          <div className="w-24 h-24 flex-shrink-0 bg-neutral-100 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-neutral-300" />
          </div>
        )}
        
        <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {place.category && (
                  <Select value={place.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger 
                      className="h-auto px-1.5 py-0 rounded-full bg-coral-500/10 text-coral-500 text-[9px] font-bold uppercase tracking-wider hover:bg-coral-500/20 transition-colors border-none shadow-none w-auto mb-0.5"
                      data-testid={`category-picker-${place.id}`}
                    >
                      <SelectValue>
                        {updateCategoryMutation.isPending ? '...' : place.category}
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
                )}
                <h3 className="font-heading text-sm font-bold text-gunmetal-900 truncate">
                  {place.name}
                </h3>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                {place.rating && (
                  <div className="flex items-center gap-0.5 text-xs font-medium text-gunmetal-700" data-testid={`place-rating-${place.id}`}>
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {(place.rating / 2).toFixed(1)}
                  </div>
                )}
                {place.lat && place.lng && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-gunmetal-500 hover:bg-coral-500/10 hover:text-coral-500 transition-colors"
                    data-testid={`navigate-place-${place.id}`}
                  >
                    <Navigation className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex items-center text-gunmetal-500 text-xs mt-0.5">
              <MapPin className="w-3 h-3 mr-0.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2 text-xs text-gunmetal-500">
              {place.isOpenNow !== null && place.isOpenNow !== undefined && (
                <span className={`flex items-center gap-0.5 ${place.isOpenNow ? 'text-green-600' : 'text-gunmetal-400'}`}>
                  <Clock className="w-3 h-3" />
                  {place.isOpenNow ? 'Open' : 'Closed'}
                </span>
              )}
              {place.priceLevel && (
                <span className="font-medium">
                  {'$'.repeat(place.priceLevel)}
                  <span className="text-gunmetal-300">{'$'.repeat(4 - place.priceLevel)}</span>
                </span>
              )}
            </div>
            
            {hasDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-coral-500 hover:text-coral-600 flex items-center gap-0.5"
                data-testid={`expand-place-${place.id}`}
              >
                {expanded ? 'Less' : 'More'}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {expanded && hasDetails && (
        <div className="border-t border-neutral-100 px-3 py-2 bg-neutral-50">
          <div className="flex flex-wrap gap-3 text-xs text-gunmetal-600">
            {place.hoursDisplay && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gunmetal-400" />
                <span>{place.hoursDisplay}</span>
              </div>
            )}
            {place.website && (
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-coral-500 hover:text-coral-600"
                data-testid={`website-place-${place.id}`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{formatWebsiteForDisplay(place.website)}</span>
              </a>
            )}
            {place.phone && (
              <a
                href={`tel:${place.phone}`}
                className="flex items-center gap-1 text-coral-500 hover:text-coral-600"
                data-testid={`phone-place-${place.id}`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{formatPhoneForDisplay(place.phone)}</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
