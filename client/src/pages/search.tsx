import { TabBar } from '@/components/TabBar';
import { Compass, MapPin, List, Loader2, Star, UtensilsCrossed, Bed, Check, X, Plus, FolderPlus } from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllPlaces, fetchCollections, createCollection, copyPlacesToCollection } from '@/lib/api';
import { PlaceMap } from '@/components/PlaceMap';
import { PlaceDrawer } from '@/components/PlaceDrawer';
import type { PlaceWithEnrichment, Collection } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<number>>(new Set());
  const [addToVenturrOpen, setAddToVenturrOpen] = useState(false);
  const [newVenturrName, setNewVenturrName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const pendingPlaceIdRef = useRef<number | null>(null);

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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['all-places'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (result.copiedCount > 0) {
        toast.success(`Added ${result.copiedCount} place${result.copiedCount > 1 ? 's' : ''} to Venturr`);
      } else {
        toast.info('All places were already in that Venturr');
      }
    },
    onError: () => {
      toast.error('Failed to add places');
    },
  });

  const validPlaces = places.filter(p => p.lat !== null && p.lng !== null);

  const filteredPlaces = useMemo(() => {
    return validPlaces.filter(place => {
      return !categoryFilter || place.category === categoryFilter;
    });
  }, [validPlaces, categoryFilter]);

  const getCollectionName = (collectionId: number) => {
    const collection = collections.find(c => c.id === collectionId);
    return collection?.title || 'Unknown';
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

  const togglePlaceSelection = (placeId: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedPlaceIds(prev => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPlaceIds(new Set());
  };

  const handleAddToVenturr = (place?: PlaceWithEnrichment) => {
    if (place && place.venturrPlaceId != null) {
      pendingPlaceIdRef.current = place.venturrPlaceId;
      setSelectedPlaceIds(new Set([place.venturrPlaceId]));
    }
    setDrawerOpen(false);
    setTimeout(() => {
      setAddToVenturrOpen(true);
    }, 100);
  };

  useEffect(() => {
    if (addToVenturrOpen) {
      if (pendingPlaceIdRef.current !== null) {
        setSelectedPlaceIds(new Set([pendingPlaceIdRef.current]));
        pendingPlaceIdRef.current = null;
      }
    } else {
      setNewVenturrName('');
      setIsCreatingNew(false);
      setIsAdding(false);
    }
  }, [addToVenturrOpen]);

  const handleSelectCollection = async (collection: Collection) => {
    const placeIds = Array.from(selectedPlaceIds);
    if (placeIds.length === 0) {
      toast.error('No places selected');
      return;
    }
    setIsAdding(true);
    try {
      await copyMutation.mutateAsync({ collectionId: collection.id, placeIds });
      toast.success(`Added to ${collection.title}`);
      setAddToVenturrOpen(false);
    } catch {
      toast.error('Failed to add places');
      setIsAdding(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newVenturrName.trim()) return;
    
    setIsAdding(true);
    try {
      const newCollection = await createMutation.mutateAsync(newVenturrName.trim());
      const placeIds = Array.from(selectedPlaceIds);
      await copyMutation.mutateAsync({ collectionId: newCollection.id, placeIds });
      toast.success(`Added to ${newCollection.title}`);
      setAddToVenturrOpen(false);
    } catch {
      toast.error('Failed to create Venturr');
      setIsAdding(false);
    }
  };

  const selectedPlaces = useMemo(() => {
    return validPlaces.filter(p => selectedPlaceIds.has(p.venturrPlaceId!));
  }, [validPlaces, selectedPlaceIds]);

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
                view === 'map' ? "bg-background shadow-sm" : "hover:bg-background/50"
              )}
              data-testid="button-view-map"
            >
              <MapPin className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                "p-2 rounded-md transition-colors",
                view === 'list' ? "bg-background shadow-sm" : "hover:bg-background/50"
              )}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CATEGORY_FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
                (categoryFilter === key || (key === null && categoryFilter === null))
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              data-testid={`button-filter-${key || 'all'}`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : validPlaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
            <MapPin className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No places yet</h2>
            <p className="text-muted-foreground max-w-xs">
              Add TikTok or Instagram links to your Venturrs and we'll extract the travel locations automatically.
            </p>
          </div>
        ) : view === 'map' ? (
          <div className="absolute inset-0">
            <PlaceMap
              places={filteredPlaces}
              onPlaceSelect={handlePlaceSelect}
              selectedPlaceId={selectedPlace?.id}
              showUserPlacesOnly={true}
            />

            <div className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 text-center border border-border pointer-events-none">
              <p className="text-sm font-medium">
                {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'} 
                {categoryFilter ? ' in ' + categoryFilter : ' saved'}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-3">
            {filteredPlaces.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No places match your filters</p>
            ) : (
              filteredPlaces.map((place) => {
                const isSelected = place.venturrPlaceId ? selectedPlaceIds.has(place.venturrPlaceId) : false;
                return (
                  <div
                    key={place.id}
                    className="flex items-center gap-3"
                  >
                    <button
                      onClick={(e) => place.venturrPlaceId && togglePlaceSelection(place.venturrPlaceId, e)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected 
                          ? "bg-coral-500 border-coral-500 text-white" 
                          : "border-neutral-300 hover:border-coral-300"
                      )}
                      data-testid={`checkbox-place-${place.id}`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                    
                    <button
                      onClick={() => handlePlaceSelect(place)}
                      className="flex-1 flex items-center gap-4 p-4 bg-card border border-border rounded-lg text-left hover:bg-muted/50 transition-colors"
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
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {selectedPlaceIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-20 bg-gunmetal-900 text-white rounded-xl p-3 shadow-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
              data-testid="button-clear-selection"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">
              {selectedPlaceIds.size} selected
            </span>
          </div>
          <button
            onClick={() => setAddToVenturrOpen(true)}
            className="px-4 py-2 bg-coral-500 rounded-lg font-medium flex items-center gap-2 hover:bg-coral-600 transition-colors"
            data-testid="button-add-selected-to-venturr"
          >
            <FolderPlus className="w-4 h-4" />
            Add to Venturr
          </button>
        </div>
      )}

      <PlaceDrawer
        place={selectedPlace}
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        showVenturrMembership={true}
        onAddToVenturr={handleAddToVenturr}
      />

      <Dialog open={addToVenturrOpen} onOpenChange={setAddToVenturrOpen}>
        <DialogContent 
          className="max-w-md rounded-[14px] shadow-sm"
          onInteractOutside={(e) => {
            if (isAdding) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isAdding) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-semibold text-gunmetal-900">
              Add to Venturr
            </DialogTitle>
            <DialogDescription className="text-gunmetal-500">
              {selectedPlaceIds.size === 1 
                ? 'Choose a Venturr to add this place to'
                : `Choose a Venturr to add ${selectedPlaceIds.size} places to`}
            </DialogDescription>
          </DialogHeader>

          {isAdding ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#F25F5C]" />
              <p className="text-sm text-gunmetal-500">Adding place...</p>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {isCreatingNew ? (
                <div className="space-y-3">
                  <Input
                    type="text"
                    value={newVenturrName}
                    onChange={(e) => setNewVenturrName(e.target.value)}
                    placeholder="New Venturr name..."
                    className="h-12 px-4 rounded-[14px] border-neutral-200 focus:ring-[#F25F5C] focus:border-[#F25F5C]"
                    autoFocus
                    data-testid="input-new-venturr-name"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsCreatingNew(false);
                        setNewVenturrName('');
                      }}
                      className="flex-1 h-11 rounded-[14px] border border-neutral-200 bg-white font-medium hover:bg-neutral-50 transition-colors"
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateAndAdd}
                      disabled={!newVenturrName.trim()}
                      className="flex-1 h-11 rounded-[14px] bg-[#F25F5C] text-white font-medium hover:bg-[#e04e4b] transition-colors disabled:opacity-50"
                      data-testid="button-create-and-add"
                    >
                      Create & Add
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsCreatingNew(true)}
                    className="w-full h-12 rounded-[14px] border-2 border-dashed border-[#F25F5C]/40 text-[#F25F5C] font-medium hover:bg-[#F25F5C]/5 transition-colors flex items-center justify-center gap-2"
                    data-testid="button-create-new-venturr"
                  >
                    <Plus className="w-5 h-5" />
                    Create new Venturr
                  </button>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={() => handleSelectCollection(collection)}
                        className="w-full py-3 px-4 rounded-[14px] border border-neutral-200 bg-white text-left font-medium hover:border-[#F25F5C]/40 hover:bg-[#F25F5C]/5 transition-colors flex items-center justify-between"
                        data-testid={`button-select-venturr-${collection.id}`}
                      >
                        <span className="truncate text-gunmetal-900">{collection.title}</span>
                        <FolderPlus className="w-4 h-4 text-gunmetal-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TabBar />
    </div>
  );
}
