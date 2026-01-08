import { TabBar } from '@/components/TabBar';
import { Compass, MapPin, List, Loader2, Star, UtensilsCrossed, Bed, Plus } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllPlaces, fetchCollections, createCollection, copyPlacesToCollection, getPhotoUrl } from '@/lib/api';
import { PlaceMap } from '@/components/PlaceMap';
import { PlaceDrawer } from '@/components/PlaceDrawer';
import { AddPostDrawer } from '@/components/AddPostDrawer';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
  const addPostTriggerRef = useRef<HTMLButtonElement>(null);

  const openAddPlace = () => {
    addPostTriggerRef.current?.click();
  };

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

  const validPlaces = places.filter((p) => p.lat !== null && p.lng !== null);

  const filteredPlaces = useMemo(() => {
    return validPlaces.filter((place) => {
      return !categoryFilter || place.category === categoryFilter;
    });
  }, [validPlaces, categoryFilter]);

  const getCollectionName = (collectionId: number | null) => {
    if (collectionId === null) return '';
    const collection = collections.find((c) => c.id === collectionId);
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
        placeIds: [place.venturrPlaceId],
      });

      if (result.copiedCount > 0) {
        const collection = collections.find((c) => c.id === collectionId);
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
        placeIds: [place.venturrPlaceId],
      });
      toast.success(`Added to ${newCollection.title}`);
    } catch (err) {
      toast.error('Failed to create Venturr');
      throw err;
    } finally {
      setIsAddingToCollection(false);
    }
  };

  const showEmptyResults = !isLoading && filteredPlaces.length === 0;

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
                'p-2 rounded-md transition-colors',
                view === 'map' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              )}
              data-testid="button-view-map"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-md transition-colors',
                view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              )}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="-mx-6 w-[calc(100%+3rem)]">
          {/* This inner div must overflow horizontally */}
          <div className="flex flex-nowrap gap-2 px-6 pb-2">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.key || 'all'}
                onClick={() => setCategoryFilter(filter.key)}
                className={cn(
                  // ✅ critical: shrink-0 + whitespace-nowrap
                  'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5',
                  categoryFilter === filter.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                data-testid={`filter-${filter.key || 'all'}`}
              >
                {filter.icon && <filter.icon className="w-3.5 h-3.5" />}
                {filter.label}
              </button>
            ))}
          </div>

          {/* Keep it scrollable but hide bar */}
          <ScrollBar orientation="horizontal" className="h-2 opacity-0" />
        </ScrollArea>

      </div>

      <div className="flex-1 relative min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : view === 'map' ? (
          <div className="absolute inset-0">
            {/* ✅ Map always renders, even when places=[] */}
            <PlaceMap places={filteredPlaces} onPlaceSelect={handlePlaceSelect} selectedPlaceId={selectedPlace?.id} />

            {/* ✅ Empty state becomes an overlay CTA button */}
            {showEmptyResults && (
              <div className="absolute inset-x-4 bottom-6 z-10">
                <button
                  onClick={openAddPlace}
                  className="w-full rounded-[16px] bg-white/95 backdrop-blur border border-border shadow-sm px-4 py-3 text-left"
                  data-testid="button-empty-add-place"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {places.length === 0 ? 'No places yet' : 'No places match this filter'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Tap to add a post, we'll then add its place to the map
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            {filteredPlaces.length === 0 ? (
              <button
                onClick={openAddPlace}
                className="w-full rounded-[16px] border border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-center"
                data-testid="button-empty-add-place-list"
              >
                <p className="font-semibold text-foreground">
                  {places.length === 0 ? 'No places yet' : 'No places match your filters'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Tap to add a post, we'll then add its place to the map</p>
              </button>
            ) : (
              filteredPlaces.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handlePlaceSelect(place)}
                  className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-lg text-left hover:bg-muted/50 transition-colors"
                  data-testid={`place-card-${place.id}`}
                >
                  {getPhotoUrl(place.photoUrl) ? (
                    <img
                      src={getPhotoUrl(place.photoUrl)!}
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

      <AddPostDrawer>
        <button ref={addPostTriggerRef} className="hidden" aria-hidden="true" />
      </AddPostDrawer>

      <TabBar onAddClick={openAddPlace} />
    </div>
  );
}