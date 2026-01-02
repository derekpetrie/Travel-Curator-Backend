import { MapPin, Navigation } from 'lucide-react';
import type { Place } from '@shared/schema';

interface PlaceCardProps {
  place: Place;
}

export function PlaceCard({ place }: PlaceCardProps) {
  return (
    <div className="flex flex-col p-4 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          {place.category && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                {place.category}
              </span>
            </div>
          )}
          <h3 className="font-heading text-lg font-bold text-foreground">
            {place.name}
          </h3>
        </div>
        <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
          <Navigation className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center text-muted-foreground text-sm">
        <MapPin className="w-3.5 h-3.5 mr-1" />
        {[place.city, place.country].filter(Boolean).join(', ') || 'Unknown location'}
      </div>
    </div>
  );
}
