import { Drawer } from 'vaul';
import { MapPin, Navigation, Star, Clock, Phone, Globe, ChevronDown, ChevronUp, FolderPlus, ExternalLink, Plus, Loader2, Check } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PlaceWithEnrichment, Collection } from '@shared/schema';
import { fetchCollectionsForPlace } from '@/lib/api';
import { Input } from '@/components/ui/input';

function getSourceDisplayName(source: string | null | undefined): string {
  if (!source) return 'social post';
  switch (source.toLowerCase()) {
    case 'tiktok': return 'TikTok';
    case 'instagram': return 'Instagram';
    default: return 'social post';
  }
}

interface PlaceDrawerProps {
  place: PlaceWithEnrichment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venturrName?: string;
  showVenturrMembership?: boolean;
  collections?: Collection[];
  onAddToCollection?: (place: PlaceWithEnrichment, collectionId: number) => Promise<{ copiedCount: number }>;
  onCreateAndAdd?: (place: PlaceWithEnrichment, title: string) => Promise<void>;
  isAddingToCollection?: boolean;
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

export function PlaceDrawer({ 
  place, 
  open, 
  onOpenChange, 
  venturrName, 
  showVenturrMembership = false,
  collections = [],
  onAddToCollection,
  onCreateAndAdd,
  isAddingToCollection = false
}: PlaceDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showVenturrPicker, setShowVenturrPicker] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newVenturrName, setNewVenturrName] = useState('');
  const [addedToId, setAddedToId] = useState<number | null>(null);

  const { data: memberVenturrs = [] } = useQuery({
    queryKey: ['place-collections', place?.venturrPlaceId],
    queryFn: () => fetchCollectionsForPlace(place!.venturrPlaceId!),
    enabled: showVenturrMembership && open && !!place?.venturrPlaceId,
  });

  const handleSelectCollection = async (collection: Collection) => {
    if (!place || !onAddToCollection || isAddingToCollection) return;
    try {
      const result = await onAddToCollection(place, collection.id);
      if (result.copiedCount > 0) {
        setAddedToId(collection.id);
        setTimeout(() => {
          setShowVenturrPicker(false);
          setAddedToId(null);
        }, 800);
      } else {
        setShowVenturrPicker(false);
      }
    } catch {
      // Error is handled by parent (toast), keep picker open for retry
    }
  };

  const handleCreateAndAdd = async () => {
    if (!place || !onCreateAndAdd || !newVenturrName.trim() || isAddingToCollection) return;
    try {
      await onCreateAndAdd(place, newVenturrName.trim());
      setNewVenturrName('');
      setIsCreatingNew(false);
      setShowVenturrPicker(false);
    } catch {
      // Error is handled by parent (toast), keep form open for retry
    }
  };

  const resetPickerState = () => {
    setShowVenturrPicker(false);
    setIsCreatingNew(false);
    setNewVenturrName('');
    setAddedToId(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetPickerState();
    }
    onOpenChange(newOpen);
  };

  if (!place) return null;

  const hasDetails = place.website || place.phone || place.hoursDisplay;
  const location = place.addressFull || [place.city, place.country].filter(Boolean).join(', ') || 'Unknown location';
  const showAddButton = !!onAddToCollection;
  const canCreateNew = !!onCreateAndAdd;

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="bg-background flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-50 outline-none max-h-[85vh]">
          <div className="p-4 bg-background rounded-t-[20px] overflow-y-auto">
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
                    </div>
                    
                    {hasDetails && (
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center text-xs text-coral-500 font-medium"
                        data-testid="button-toggle-details"
                      >
                        {expanded ? (
                          <>Less <ChevronUp className="w-3 h-3 ml-0.5" /></>
                        ) : (
                          <>More <ChevronDown className="w-3 h-3 ml-0.5" /></>
                        )}
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

            {venturrName && !showVenturrMembership && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Saved in <span className="font-medium text-foreground">{venturrName}</span>
              </p>
            )}

            {showVenturrMembership && memberVenturrs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <p className="text-xs text-muted-foreground mb-2">Saved in:</p>
                <div className="flex flex-wrap gap-1.5">
                  {memberVenturrs.map(v => (
                    <span
                      key={v.id}
                      className="inline-block px-2 py-1 rounded-full bg-coral-500/10 text-coral-600 text-xs font-medium"
                      data-testid={`tag-venturr-${v.id}`}
                    >
                      {v.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {place.sourcePostUrl && (
              <div className="mt-3 pt-3 border-t border-neutral-200">
                <a
                  href={place.sourcePostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gunmetal-600 hover:text-coral-500 transition-colors"
                  data-testid="link-source-post"
                >
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    You discovered this from a <span className="font-medium text-coral-500">{getSourceDisplayName(place.sourcePostSource)}</span> post
                  </span>
                </a>
              </div>
            )}

            {showAddButton && (
              <div className="mt-4">
                {!showVenturrPicker ? (
                  <button
                    onClick={() => setShowVenturrPicker(true)}
                    className="w-full py-3 rounded-[14px] bg-[#F25F5C] text-white font-semibold shadow-sm hover:bg-[#e04e4b] transition-colors flex items-center justify-center gap-2"
                    data-testid="button-add-to-venturr"
                  >
                    <FolderPlus className="w-4 h-4" />
                    Add to Venturr
                  </button>
                ) : (
                  <div className="rounded-[14px] border border-neutral-200 bg-white overflow-hidden">
                    <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                      <span className="text-sm font-medium text-gunmetal-900">Choose a Venturr</span>
                      <button
                        onClick={resetPickerState}
                        className="text-xs text-gunmetal-500 hover:text-gunmetal-700"
                        data-testid="button-cancel-picker"
                      >
                        Cancel
                      </button>
                    </div>
                    
                    <div className="p-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {isCreatingNew ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleCreateAndAdd();
                          }}
                          className="space-y-2"
                        >
                          <Input
                            type="text"
                            value={newVenturrName}
                            onChange={(e) => setNewVenturrName(e.target.value)}
                            placeholder="Venturr name..."
                            className="h-10 text-sm"
                            autoFocus
                            disabled={isAddingToCollection}
                            data-testid="input-new-venturr-name"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingNew(false);
                                setNewVenturrName('');
                              }}
                              disabled={isAddingToCollection}
                              className="flex-1 h-9 rounded-lg border border-neutral-200 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
                              data-testid="button-cancel-create"
                            >
                              Back
                            </button>
                            <button
                              type="submit"
                              disabled={!newVenturrName.trim() || isAddingToCollection}
                              className="flex-1 h-9 rounded-lg bg-[#F25F5C] text-white text-sm font-medium hover:bg-[#e04e4b] disabled:opacity-50 flex items-center justify-center gap-1"
                              data-testid="button-create-and-add"
                            >
                              {isAddingToCollection ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>Create & Add</>
                              )}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {canCreateNew && (
                            <button
                              onClick={() => setIsCreatingNew(true)}
                              disabled={isAddingToCollection}
                              className="w-full py-2.5 px-3 rounded-lg border-2 border-dashed border-[#F25F5C]/40 text-[#F25F5C] text-sm font-medium hover:bg-[#F25F5C]/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                              data-testid="button-create-new-venturr"
                            >
                              <Plus className="w-4 h-4" />
                              Create new Venturr
                            </button>
                          )}

                          {collections.length === 0 ? (
                            <p className="text-xs text-gunmetal-500 text-center py-3">
                              {canCreateNew ? 'No Venturrs yet. Create one above.' : 'No Venturrs available.'}
                            </p>
                          ) : (
                            collections.map((collection) => (
                              <button
                                key={collection.id}
                                onClick={() => handleSelectCollection(collection)}
                                disabled={isAddingToCollection}
                                className="w-full py-2.5 px-3 rounded-lg border border-neutral-200 bg-white text-left text-sm font-medium hover:border-[#F25F5C]/40 hover:bg-[#F25F5C]/5 transition-colors flex items-center justify-between disabled:opacity-50"
                                data-testid={`button-select-venturr-${collection.id}`}
                              >
                                <span className="truncate text-gunmetal-900">{collection.title}</span>
                                {addedToId === collection.id ? (
                                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : isAddingToCollection ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-gunmetal-400 flex-shrink-0" />
                                ) : (
                                  <FolderPlus className="w-4 h-4 text-gunmetal-400 flex-shrink-0" />
                                )}
                              </button>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
