import { Drawer } from 'vaul';
import { MapPin, Navigation, Star, Clock, Phone, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { PlaceWithEnrichment } from '@shared/schema';

interface PlaceDrawerProps {
  place: PlaceWithEnrichment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venturrName?: string;
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

export function PlaceDrawer({ place, open, onOpenChange, venturrName }: PlaceDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!place) return null;

  const hasDetails = place.website || place.phone || place.hoursDisplay;
  const location = place.addressFull || [place.city, place.country].filter(Boolean).join(', ') || 'Unknown location';

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="bg-background flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-50 outline-none">
          <div className="p-4 bg-background rounded-t-[20px]">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-3" />
            
            <div className="rounded-[14px] bg-white border border-neutral-200 shadow-sm overflow-hidden">
              <div className="flex">
                {place.photoUrl ? (
                  <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
                    <img 
                      src={place.photoUrl} 
                      alt={place.name}
                      className="w-full h-full object-cover"
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
                          <span className="inline-block px-1.5 py-0 rounded-full bg-coral-500/10 text-coral-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">
                            {place.category}
                          </span>
                        )}
                        <h3 className="font-heading text-sm font-bold text-gunmetal-900 truncate">
                          {place.name}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {place.lat && place.lng && (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-gunmetal-500 hover:bg-coral-500/10 hover:text-coral-500 transition-colors"
                            data-testid="button-open-in-maps"
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
                      {place.rating && (
                        <div className="flex items-center gap-0.5 font-medium text-gunmetal-700">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {place.rating.toFixed(1)}
                        </div>
                      )}
                      {place.priceLevel && (
                        <span className="font-medium">
                          {'$'.repeat(place.priceLevel)}
                          <span className="text-gunmetal-300">{'$'.repeat(4 - place.priceLevel)}</span>
                        </span>
                      )}
                      {place.isOpenNow !== null && place.isOpenNow !== undefined && (
                        <span className={`flex items-center gap-0.5 ${place.isOpenNow ? 'text-green-600' : 'text-gunmetal-400'}`}>
                          <Clock className="w-3 h-3" />
                          {place.isOpenNow ? 'Open' : 'Closed'}
                        </span>
                      )}
                    </div>
                    
                    {hasDetails && (
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className="text-xs text-coral-500 hover:text-coral-600 flex items-center gap-0.5"
                        data-testid="button-expand-details"
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
                        data-testid="button-visit-website"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>{formatWebsiteForDisplay(place.website)}</span>
                      </a>
                    )}
                    {place.phone && (
                      <a
                        href={`tel:${place.phone}`}
                        className="flex items-center gap-1 text-coral-500 hover:text-coral-600"
                        data-testid="button-call-phone"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{formatPhoneForDisplay(place.phone)}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {venturrName && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Saved in <span className="font-medium text-foreground">{venturrName}</span>
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
