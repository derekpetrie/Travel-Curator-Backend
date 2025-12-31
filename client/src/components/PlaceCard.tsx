import { Place } from '@/lib/mockData';
import { MapPin, Star, Navigation } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
}

export function PlaceCard({ place }: PlaceCardProps) {
  return (
    <div className="flex flex-col p-4 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
             <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
               {place.category}
             </span>
             <div className="flex items-center text-yellow-500 gap-0.5">
               <Star className="w-3 h-3 fill-current" />
               <span className="text-xs font-bold">{place.rating}</span>
             </div>
          </div>
          <h3 className="font-heading text-lg font-bold text-foreground">
            {place.name}
          </h3>
        </div>
        <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
          <Navigation className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center text-muted-foreground text-sm mb-3">
        <MapPin className="w-3.5 h-3.5 mr-1" />
        {place.city}, {place.country}
      </div>

      <div className="mt-auto pt-3 border-t border-dashed border-border">
         <p className="text-xs text-muted-foreground">
           Found in <span className="font-medium text-foreground">{place.postIds.length} posts</span>
         </p>
      </div>
    </div>
  );
}
