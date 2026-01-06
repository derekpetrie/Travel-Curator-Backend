import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlan, generatePlan, deletePlan, updatePlan, sharePlan } from '@/lib/api';
import type { PlaceWithEnrichment, PlanContent } from '@shared/schema';
import { Sparkles, Loader2, AlertCircle, Clock, MapPin, Sun, Sunrise, Sunset, Calendar, RefreshCw, Trash2, Pencil, Check, X, Share2, Link, Copy, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlanTabProps {
  collectionId: number;
  places: PlaceWithEnrichment[];
  placesLoading: boolean;
}

export function PlanTab({ collectionId, places, placesLoading }: PlanTabProps) {
  const queryClient = useQueryClient();
  const [durationDays, setDurationDays] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<PlanContent | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragPlace, setActiveDragPlace] = useState<PlaceWithEnrichment | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShareMenu]);

  const { data: planData, isLoading: planLoading, refetch } = useQuery({
    queryKey: ['plan', collectionId],
    queryFn: () => fetchPlan(collectionId),
    enabled: !!collectionId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.plan?.status === 'generating') {
        return 2000;
      }
      return false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generatePlan(collectionId, durationDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', collectionId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePlan(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', collectionId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (content: PlanContent) => updatePlan(collectionId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', collectionId] });
      setIsEditing(false);
      setEditedContent(null);
    },
  });

  const shareMutation = useMutation({
    mutationFn: (isPublic: boolean) => sharePlan(collectionId, isPublic),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['plan', collectionId] });
      if (data.shareUrl) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        navigator.clipboard.writeText(fullUrl).catch(() => {});
      }
    },
  });

  const plan = planData?.plan;
  const isStale = planData?.isStale;
  const isGenerating = plan?.status === 'generating' || generateMutation.isPending;
  const hasFailed = plan?.status === 'failed';
  const isReady = plan?.status === 'ready';

  const placesMap = new Map(places.map(p => [p.venturrPlaceId || p.id, p]));

  const startEditing = useCallback(() => {
    if (plan?.content) {
      setEditedContent(JSON.parse(JSON.stringify(plan.content)));
      setIsEditing(true);
    }
  }, [plan?.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditedContent(null);
  }, []);

  const saveEdits = useCallback(() => {
    if (editedContent) {
      updateMutation.mutate(editedContent);
    }
  }, [editedContent, updateMutation]);

  const updateBlockField = useCallback((dayIndex: number, blockIndex: number, field: string, value: string) => {
    if (!editedContent) return;
    const newContent = { ...editedContent };
    newContent.days = [...newContent.days];
    newContent.days[dayIndex] = { ...newContent.days[dayIndex] };
    newContent.days[dayIndex].blocks = [...newContent.days[dayIndex].blocks];
    newContent.days[dayIndex].blocks[blockIndex] = {
      ...newContent.days[dayIndex].blocks[blockIndex],
      [field]: value || null,
    };
    setEditedContent(newContent);
  }, [editedContent]);

  const updateDayTitle = useCallback((dayIndex: number, title: string) => {
    if (!editedContent) return;
    const newContent = { ...editedContent };
    newContent.days = [...newContent.days];
    newContent.days[dayIndex] = { ...newContent.days[dayIndex], title: title || undefined };
    setEditedContent(newContent);
  }, [editedContent]);

  const removePlaceFromBlock = useCallback((dayIndex: number, blockIndex: number, placeId: number) => {
    if (!editedContent) return;
    const currentPlaceIds = editedContent.days[dayIndex].blocks[blockIndex].placeIds;
    if (currentPlaceIds.length <= 1) return;
    const newContent = { ...editedContent };
    newContent.days = [...newContent.days];
    newContent.days[dayIndex] = { ...newContent.days[dayIndex] };
    newContent.days[dayIndex].blocks = [...newContent.days[dayIndex].blocks];
    newContent.days[dayIndex].blocks[blockIndex] = {
      ...newContent.days[dayIndex].blocks[blockIndex],
      placeIds: currentPlaceIds.filter(id => id !== placeId),
    };
    setEditedContent(newContent);
  }, [editedContent]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
    const placeId = parseInt((active.id as string).split('-').pop() || '0');
    const place = places.find(p => (p.venturrPlaceId || p.id) === placeId);
    setActiveDragPlace(place || null);
  }, [places]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setActiveDragPlace(null);

    if (!over || !editedContent) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const parseDragId = (id: string) => {
      const parts = id.split('-');
      return {
        dayIndex: parseInt(parts[1]),
        blockIndex: parseInt(parts[2]),
        placeId: parseInt(parts[3]),
      };
    };

    const from = parseDragId(activeId);
    const to = parseDragId(overId);

    const newContent = JSON.parse(JSON.stringify(editedContent)) as PlanContent;

    const fromBlock = newContent.days[from.dayIndex].blocks[from.blockIndex];
    const toBlock = newContent.days[to.dayIndex].blocks[to.blockIndex];

    const fromIndex = fromBlock.placeIds.indexOf(from.placeId);
    if (fromIndex === -1) return;

    if (from.dayIndex === to.dayIndex && from.blockIndex === to.blockIndex) {
      const toIndex = fromBlock.placeIds.indexOf(to.placeId);
      if (toIndex === -1) return;
      fromBlock.placeIds = arrayMove(fromBlock.placeIds, fromIndex, toIndex);
    } else {
      if (fromBlock.placeIds.length <= 1) return;
      fromBlock.placeIds.splice(fromIndex, 1);
      const toIndex = toBlock.placeIds.indexOf(to.placeId);
      if (toIndex === -1) {
        toBlock.placeIds.push(from.placeId);
      } else {
        toBlock.placeIds.splice(toIndex, 0, from.placeId);
      }
    }

    setEditedContent(newContent);
  }, [editedContent]);

  const handleShare = useCallback(async () => {
    await shareMutation.mutateAsync(true);
    setShowShareMenu(false);
  }, [shareMutation]);

  const handleUnshare = useCallback(async () => {
    await shareMutation.mutateAsync(false);
    setShowShareMenu(false);
  }, [shareMutation]);

  const copyShareLink = useCallback(() => {
    if (plan?.shareSlug) {
      const fullUrl = `${window.location.origin}/plan/${plan.shareSlug}`;
      navigator.clipboard.writeText(fullUrl).catch(() => {});
    }
  }, [plan?.shareSlug]);

  if (planLoading || placesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (places.length === 0) {
    return <EmptyPlacesState />;
  }

  if (!plan || (!isReady && !isGenerating)) {
    return (
      <EmptyPlanState 
        durationDays={durationDays}
        setDurationDays={setDurationDays}
        onGenerate={() => generateMutation.mutate()}
        isGenerating={isGenerating}
        error={generateMutation.error?.message || (hasFailed ? 'Plan generation failed. Please try again.' : undefined)}
      />
    );
  }

  if (isGenerating) {
    return <GeneratingState />;
  }

  const content = isEditing && editedContent ? editedContent : (plan.content as PlanContent);
  const isPublic = plan.isPublic;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={saveEdits}
                disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="button-save-plan"
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
                data-testid="button-cancel-edit"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
              data-testid="button-edit-plan"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>
        
        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              isPublic 
                ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20" 
                : "border border-border hover:bg-muted"
            )}
            data-testid="button-share-menu"
          >
            <Share2 className="w-3.5 h-3.5" />
            {isPublic ? 'Shared' : 'Share'}
            <ChevronDown className="w-3 h-3" />
          </button>
          
          {showShareMenu && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              {isPublic ? (
                <>
                  <button
                    onClick={copyShareLink}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors"
                    data-testid="button-copy-link"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">Copy link</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {window.location.origin}/plan/{plan.shareSlug}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={handleUnshare}
                    disabled={shareMutation.isPending}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors border-t border-border text-destructive"
                    data-testid="button-unshare"
                  >
                    <X className="w-4 h-4" />
                    Stop sharing
                  </button>
                </>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={shareMutation.isPending}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-muted transition-colors"
                  data-testid="button-share-public"
                >
                  <Link className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Create public link</div>
                    <div className="text-xs text-muted-foreground">Anyone with the link can view</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isStale && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Your places have changed since this plan was created.</span>
          <button
            onClick={() => generateMutation.mutate()}
            className="ml-auto text-amber-900 font-medium hover:underline"
            data-testid="button-regenerate-plan"
          >
            Regenerate
          </button>
        </div>
      )}

      {content.overview && (
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/20 rounded-xl border border-primary/30">
          <p className="text-foreground/90" data-testid="text-plan-summary">
            {content.overview.summary}
          </p>
          {content.overview.travelTips && content.overview.travelTips.length > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/20">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Tips</p>
              <ul className="text-sm text-foreground/80 space-y-1">
                {content.overview.travelTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {content.days.map((day, dayIndex) => (
        <DayCard 
          key={day.dayNumber} 
          day={day} 
          dayIndex={dayIndex}
          placesMap={placesMap}
          isEditing={isEditing}
          sensors={sensors}
          activeDragPlace={activeDragPlace}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onUpdateDayTitle={(title) => updateDayTitle(dayIndex, title)}
          onUpdateBlockField={(blockIndex, field, value) => updateBlockField(dayIndex, blockIndex, field, value)}
          onRemovePlace={(blockIndex, placeId) => removePlaceFromBlock(dayIndex, blockIndex, placeId)}
        />
      ))}

      {content.notes && (
        <div className="p-4 bg-muted/50 rounded-xl text-sm text-muted-foreground italic">
          {content.notes}
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button
          onClick={() => generateMutation.mutate()}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg border border-border hover:bg-muted transition-colors"
          data-testid="button-regenerate-plan-bottom"
        >
          <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
          Regenerate
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="px-4 py-3 text-sm font-bold rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
          data-testid="button-delete-plan"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyPlacesState() {
  return (
    <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
      <MapPin className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground mb-2">Add some places first</p>
      <p className="text-sm text-muted-foreground/70">
        Share TikTok or Instagram posts to extract travel locations,<br />
        then come back to generate your plan.
      </p>
    </div>
  );
}

interface EmptyPlanStateProps {
  durationDays: number;
  setDurationDays: (days: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error?: string;
}

function EmptyPlanState({ durationDays, setDurationDays, onGenerate, isGenerating, error }: EmptyPlanStateProps) {
  return (
    <div className="py-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">Create Your Travel Plan</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        Let AI organize your saved places into a day-by-day itinerary.
      </p>

      <div className="flex items-center justify-center gap-2 mb-6">
        <span className="text-sm text-muted-foreground">Plan for</span>
        <select
          value={durationDays}
          onChange={(e) => setDurationDays(parseInt(e.target.value))}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-background"
          data-testid="select-plan-duration"
        >
          {[1, 2, 3, 4, 5, 6, 7].map(n => (
            <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 mb-4 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        data-testid="button-generate-plan"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Generate Plan
          </span>
        )}
      </button>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="py-16 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">Creating Your Plan</h3>
      <p className="text-sm text-muted-foreground">
        AI is organizing your places into an optimal itinerary...
      </p>
    </div>
  );
}

interface DayCardProps {
  day: {
    dayNumber: number;
    title?: string | null;
    blocks: Array<{
      id: string;
      title?: string | null;
      timeOfDay?: string;
      placeIds: number[];
      notes?: string | null;
    }>;
  };
  dayIndex: number;
  placesMap: Map<number, PlaceWithEnrichment>;
  isEditing: boolean;
  sensors: ReturnType<typeof useSensors>;
  activeDragPlace: PlaceWithEnrichment | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onUpdateDayTitle: (title: string) => void;
  onUpdateBlockField: (blockIndex: number, field: string, value: string) => void;
  onRemovePlace: (blockIndex: number, placeId: number) => void;
}

const TIME_OF_DAY_OPTIONS = ['morning', 'afternoon', 'evening', 'flexible'] as const;

function DayCard({ day, dayIndex, placesMap, isEditing, sensors, activeDragPlace, onDragStart, onDragEnd, onUpdateDayTitle, onUpdateBlockField, onRemovePlace }: DayCardProps) {
  const timeIcons: Record<string, React.ReactNode> = {
    morning: <Sunrise className="w-3.5 h-3.5" />,
    afternoon: <Sun className="w-3.5 h-3.5" />,
    evening: <Sunset className="w-3.5 h-3.5" />,
    flexible: <Clock className="w-3.5 h-3.5" />,
  };

  const allPlaceIds = day.blocks.flatMap((block, blockIndex) =>
    block.placeIds.map(placeId => `place-${dayIndex}-${blockIndex}-${placeId}`)
  );

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden" data-testid={`card-day-${day.dayNumber}`}>
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        <span className="font-bold text-foreground">Day {day.dayNumber}</span>
        {isEditing ? (
          <input
            type="text"
            value={day.title || ''}
            onChange={(e) => onUpdateDayTitle(e.target.value)}
            placeholder="Add day title..."
            className="flex-1 px-2 py-0.5 text-sm border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid={`input-day-title-${day.dayNumber}`}
          />
        ) : (
          day.title && <span className="text-muted-foreground">— {day.title}</span>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="p-4 space-y-4">
          {day.blocks.map((block, blockIndex) => {
            const blockPlaceIds = block.placeIds.map(placeId => `place-${dayIndex}-${blockIndex}-${placeId}`);
            return (
              <div key={block.id} className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {isEditing ? (
                    <select
                      value={block.timeOfDay || 'flexible'}
                      onChange={(e) => onUpdateBlockField(blockIndex, 'timeOfDay', e.target.value)}
                      className="px-2 py-1 text-sm border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      data-testid={`select-time-${day.dayNumber}-${blockIndex}`}
                    >
                      {TIME_OF_DAY_OPTIONS.map(time => (
                        <option key={time} value={time} className="capitalize">{time}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <span className="text-muted-foreground">{timeIcons[block.timeOfDay || 'flexible'] || timeIcons.flexible}</span>
                      <span className="font-medium text-foreground/80 capitalize">{block.timeOfDay || 'flexible'}</span>
                    </>
                  )}
                  {isEditing ? (
                    <input
                      type="text"
                      value={block.title || ''}
                      onChange={(e) => onUpdateBlockField(blockIndex, 'title', e.target.value)}
                      placeholder="Block title..."
                      className="flex-1 px-2 py-0.5 text-sm border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      data-testid={`input-block-title-${day.dayNumber}-${blockIndex}`}
                    />
                  ) : (
                    block.title && <span className="text-muted-foreground">• {block.title}</span>
                  )}
                </div>
                <SortableContext items={blockPlaceIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 pl-5">
                    {block.placeIds.map((placeId) => {
                      const place = placesMap.get(placeId);
                      if (!place) return null;
                      const dragId = `place-${dayIndex}-${blockIndex}-${placeId}`;
                      return (
                        <SortablePlaceCard
                          key={dragId}
                          id={dragId}
                          place={place}
                          placeId={placeId}
                          isEditing={isEditing}
                          onRemove={() => onRemovePlace(blockIndex, placeId)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
                {isEditing ? (
                  <textarea
                    value={block.notes || ''}
                    onChange={(e) => onUpdateBlockField(blockIndex, 'notes', e.target.value)}
                    placeholder="Add notes..."
                    rows={2}
                    className="w-full ml-5 px-2 py-1.5 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    style={{ width: 'calc(100% - 1.25rem)' }}
                    data-testid={`textarea-notes-${day.dayNumber}-${blockIndex}`}
                  />
                ) : (
                  block.notes && (
                    <p className="text-xs text-muted-foreground italic pl-5">{block.notes}</p>
                  )
                )}
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeDragPlace && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-white border-2 border-primary shadow-lg">
              {activeDragPlace.photoUrl ? (
                <img src={activeDragPlace.photoUrl} alt={activeDragPlace.name} className="w-10 h-10 rounded-md object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{activeDragPlace.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activeDragPlace.city}{activeDragPlace.country ? `, ${activeDragPlace.country}` : ''}
                </p>
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface SortablePlaceCardProps {
  id: string;
  place: PlaceWithEnrichment;
  placeId: number;
  isEditing: boolean;
  onRemove: () => void;
}

function SortablePlaceCard({ id, place, placeId, isEditing, onRemove }: SortablePlaceCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg bg-muted/50 group",
        isDragging && "opacity-50"
      )}
      data-testid={`plan-place-${placeId}`}
    >
      {isEditing && (
        <button
          {...attributes}
          {...listeners}
          className="touch-none p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          data-testid={`drag-handle-${placeId}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      {place.photoUrl ? (
        <img src={place.photoUrl} alt={place.name} className="w-10 h-10 rounded-md object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
          <MapPin className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{place.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {place.city}{place.country ? `, ${place.country}` : ''}
        </p>
      </div>
      {isEditing && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all"
          data-testid={`button-remove-place-${placeId}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
