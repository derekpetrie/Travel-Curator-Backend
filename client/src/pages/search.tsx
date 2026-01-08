import { TabBar } from '@/components/TabBar';
import { Compass, MapPin, List, Loader2, Star, UtensilsCrossed, Bed } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllPlaces, fetchCollections, createCollection, copyPlacesToCollection } from '@/lib/api';
import { PlaceMap } from '@/components/PlaceMap';
import { PlaceDrawer } from '@/components/PlaceDrawer';
import type { PlaceWithEnrichment } from '@shared/schema';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORY_FILTERS = [
  { key: null, label: 'All', icon: null },
  { key: 'things to do', label: 'Things to Do', icon: Star },
  { key: 'places to eat', label: 'Places to Eat', icon: UtensilsCrossed },
  { key: 'places to stay', label: 'Places to Stay', icon: Bed },
] as const;

export default function Explore() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithEnrichment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [isAddingToCollection, setIsAddingToCollection] = useState(false);

  const { data: places = [], isLoading } = useQuery({
    queryKey: ['all-places'],
    queryFn: fetchAllPlaces,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => createCollection(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ collectionId, placeIds }: { collectionId: number; placeIds: number[] }) => 
      copyPlacesToCollection(collectionId, placeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-places'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['place-collections'] });
    },
  });

  const validPlaces = places.filter(p => p.lat !== null && p.lng !== null);

  const filteredPlaces = useMemo(() => {
    return validPlaces.filter(place => {
      return !categoryFilter || place.category === categoryFilter;
    });
  }, [validPlaces, categoryFilter]);

  const getCollectionName = (collectionId: number | null) => {
    if (collectionId === null) return '';
    const collection = collections.find(c => c.id === collectionId);
    return collection?.title || '';
  };

  const handlePlaceSelect = (place: PlaceWithEnrichment) => {
    setSelectedPlace(place);
    setDrawerOpen(true);
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setTimeout(() => setSelectedPlace(null), 300);
    }
  };

  const handleAddToCollection = async (place: PlaceWithEnrichment, collectionId: number) => {
    if (place.venturrPlaceId == null) {
      toast.error('Cannot add this place');
      throw new Error('No place ID');
    }
    
    setIsAddingToCollection(true);
    try {
      const result = await copyMutation.mutateAsync({ 
        collectionId, 
        placeIds: [place.venturrPlaceId] 
      });
      
      if (result.copiedCount > 0) {
        const collection = collections.find(c => c.id === collectionId);
        toast.success(`Added to ${collection?.title || 'Venturr'}`);
      } else {
        toast.info('Already in that Venturr');
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to add place');
      throw err;
    } finally {
      setIsAddingToCollection(false);
    }
  };

  const handleCreateAndAdd = async (place: PlaceWithEnrichment, title: string) => {
    if (place.venturrPlaceId == null) {
      toast.error('Cannot add this place');
      throw new Error('No place ID');
    }
    
    setIsAddingToCollection(true);
    try {
      const newCollection = await createMutation.mutateAsync(title);
      await copyMutation.mutateAsync({ 
        collectionId: newCollection.id, 
        placeIds: [place.venturrPlaceId] 
      });
      toast.success(`Added to ${newCollection.title}`);
    } catch (err) {
      toast.error('Failed to create Venturr');
      throw err;
    } finally {
      setIsAddingToCollection(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background safe-top flex flex-col">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-6 pb-3 border-b border-border">
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
                view === 'map' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              data-testid="button-view-map"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                "p-2 rounded-md transition-colors",
                view === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 hide-scrollbar">
          {CATEGORY_FILTERS.map(filter => (
            <button
              key={filter.key || 'all'}
              onClick={() => setCategoryFilter(filter.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
                categoryFilter === filter.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              data-testid={`filter-${filter.key || 'all'}`}
            >
              {filter.icon && <filter.icon className="w-3.5 h-3.5" />}
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground px-6 text-center">
            <MapPin className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No places yet</p>
            <p className="text-sm">Save some posts with locations to see them here</p>
          </div>
        ) : view === 'map' ? (
          <div className="h-full w-full" style={{ minHeight: 'calc(100vh - 180px)' }}>
            <PlaceMap
              places={filteredPlaces}
              onPlaceSelect={handlePlaceSelect}
              selectedPlaceId={selectedPlace?.id}
            />
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            {filteredPlaces.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No places match your filters</p>
            ) : (
              filteredPlaces.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handlePlaceSelect(place)}
                  className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-lg text-left hover:bg-muted/50 transition-colors"
                  data-testid={`place-card-${place.id}`}
                >
                  {place.photoUrl ? (
                    <img 
                      src={place.photoUrl} 
                      alt={place.name}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-foreground truncate">{place.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {[place.city, place.country].filter(Boolean).join(', ')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {place.category && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                          {place.category}
                        </span>
                      )}
                      {place.rating && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {place.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                    {getCollectionName(place.collectionId)}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <PlaceDrawer
        place={selectedPlace}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        showVenturrMembership={true}
        collections={collections}
        onAddToCollection={handleAddToCollection}
        onCreateAndAdd={handleCreateAndAdd}
        isAddingToCollection={isAddingToCollection}
      />

      <TabBar />
    </div>
  );
}
