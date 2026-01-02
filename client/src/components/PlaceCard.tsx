import { MapPin, Navigation, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Place } from '@shared/schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PLACE_CATEGORIES = [
  'restaurant', 'cafe', 'bar', 'nightlife', 'hotel', 'beach', 'attraction',
  'nature', 'park', 'landmark', 'museum', 'shopping', 'activity', 'wellness',
  'neighborhood', 'skiing', 'theme park', 'other'
] as const;

interface PlaceCardProps {
  place: Place;
}

export function PlaceCard({ place }: PlaceCardProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const updateCategoryMutation = useMutation({
    mutationFn: async (newCategory: string) => {
      const response = await apiRequest('PATCH', `/api/places/${place.id}/category`, { category: newCategory });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/collections/${place.collectionId}/places`] });
    },
  });

  const handleCategoryChange = (newCategory: string) => {
    if (newCategory !== place.category) {
      updateCategoryMutation.mutate(newCategory);
    }
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col p-4 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div>
          {place.category && (
            <div className="flex items-center gap-1.5 mb-1">
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={true}>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors"
                    data-testid={`category-picker-${place.id}`}
                  >
                    {updateCategoryMutation.isPending ? 'Updating...' : place.category}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                  {PLACE_CATEGORIES.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => handleCategoryChange(category)}
                      className={place.category === category ? 'bg-primary/10 text-primary' : ''}
                      data-testid={`category-option-${category}`}
                    >
                      <span className="capitalize">{category}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
