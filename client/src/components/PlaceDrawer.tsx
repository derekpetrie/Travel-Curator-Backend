import { Drawer } from 'vaul';
import { Star, UtensilsCrossed, Bed, MapPin, Clock, DollarSign, ExternalLink, Navigation } from 'lucide-react';
import type { PlaceWithEnrichment } from '@shared/schema';

interface PlaceDrawerProps {
  place: PlaceWithEnrichment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venturrName?: string;
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

function formatCategory(category: string | null): string {
  if (!category) return 'Place';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function getPriceDisplay(priceLevel: number | null): string | null {
  if (priceLevel === null || priceLevel === undefined) return null;
  return '$'.repeat(Math.min(Math.max(priceLevel, 1), 4));
}

export function PlaceDrawer({ place, open, onOpenChange, venturrName }: PlaceDrawerProps) {
  if (!place) return null;

  const Icon = getCategoryIcon(place.category);
  const priceDisplay = getPriceDisplay(place.priceLevel ?? null);
  
  const openInMaps = () => {
    if (place.lat && place.lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
      window.open(url, '_blank');
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="bg-background flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-50 outline-none max-h-[70vh]">
          <div className="p-4 bg-background rounded-t-[20px] flex-1 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-4" />
            
            <div className="max-w-md mx-auto space-y-4">
              {place.photoUrl && (
                <div className="w-full h-48 rounded-xl overflow-hidden bg-muted">
                  <img 
                    src={place.photoUrl} 
                    alt={place.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-xl font-bold text-foreground">{place.name}</h3>
                    <p className="text-muted-foreground text-sm">
                      {[place.city, place.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {formatCategory(place.category)}
                  </span>
                  
                  {place.rating && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="font-medium">{place.rating.toFixed(1)}</span>
                    </div>
                  )}
                  
                  {priceDisplay && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-medium">{priceDisplay}</span>
                    </div>
                  )}
                  
                  {place.isOpenNow !== null && (
                    <div className={`flex items-center gap-1 text-sm ${place.isOpenNow ? 'text-green-600' : 'text-red-500'}`}>
                      <Clock className="w-3 h-3" />
                      <span className="font-medium">{place.isOpenNow ? 'Open' : 'Closed'}</span>
                    </div>
                  )}
                </div>

                {place.hoursDisplay && (
                  <p className="text-sm text-muted-foreground">
                    {place.hoursDisplay}
                  </p>
                )}

                {venturrName && (
                  <p className="text-xs text-muted-foreground">
                    Saved in: <span className="font-medium text-foreground">{venturrName}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={openInMaps}
                  className="flex-1 h-12 bg-primary text-primary-foreground font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                  data-testid="button-open-in-maps"
                >
                  <Navigation className="w-4 h-4" />
                  Open in Maps
                </button>
                
                {place.website && (
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-12 px-4 bg-muted text-foreground font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
                    data-testid="button-visit-website"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
