import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlan, generatePlan, deletePlan, updatePlan, getPhotoUrl, type GeneratePlanOptions } from '@/lib/api';
import type { PlaceWithEnrichment, PlanContent, PlanBlock } from '@shared/schema';
import { Sparkles, Loader2, AlertCircle, Clock, MapPin, Sun, Sunrise, Sunset, Calendar, RefreshCw, Trash2, Pencil, Check, X, Users, Target, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';


interface PlanTabProps {
  collectionId: number;
  places: PlaceWithEnrichment[];
  placesLoading: boolean;
}

const PEOPLE_COUNT_OPTIONS = ['1', '2', '3-4', '5+'] as const;
const TRIP_PURPOSE_OPTIONS = [
  { value: 'date_night', label: 'Date Night' },
  { value: 'family_trip', label: 'Family Trip' },
  { value: 'friends_outing', label: 'Friends' },
  { value: 'solo', label: 'Solo' },
  { value: 'business', label: 'Business' },
] as const;

export function PlanTab({ collectionId, places, placesLoading }: PlanTabProps) {
  const queryClient = useQueryClient();
  const [durationDays, setDurationDays] = useState(3);
  const [peopleCount, setPeopleCount] = useState('2');
  const [tripPurpose, setTripPurpose] = useState('friends_outing');
  const [includeRecommendations, setIncludeRecommendations] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<PlanContent | null>(null);

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
    mutationFn: (options: GeneratePlanOptions) => generatePlan(collectionId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', collectionId] });
    },
  });

  const handleGenerate = useCallback(() => {
    generateMutation.mutate({
      durationDays,
      peopleCount,
      tripPurpose,
      includeRecommendations,
    });
  }, [durationDays, peopleCount, tripPurpose, includeRecommendations, generateMutation]);

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
        peopleCount={peopleCount}
        setPeopleCount={setPeopleCount}
        tripPurpose={tripPurpose}
        setTripPurpose={setTripPurpose}
        includeRecommendations={includeRecommendations}
        setIncludeRecommendations={setIncludeRecommendations}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        error={generateMutation.error?.message || (hasFailed ? 'Plan generation failed. Please try again.' : undefined)}
      />
    );
  }

  if (isGenerating) {
    return <GeneratingState />;
  }

  const content = isEditing && editedContent ? editedContent : (plan.content as PlanContent);

  return (
    <div className="space-y-4">
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

      {isStale && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Your places have changed since this plan was created.</span>
          <button
            onClick={handleGenerate}
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
          onClick={handleGenerate}
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
  peopleCount: string;
  setPeopleCount: (count: string) => void;
  tripPurpose: string;
  setTripPurpose: (purpose: string) => void;
  includeRecommendations: boolean;
  setIncludeRecommendations: (include: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error?: string;
}

function EmptyPlanState({ 
  durationDays, 
  setDurationDays, 
  peopleCount,
  setPeopleCount,
  tripPurpose,
  setTripPurpose,
  includeRecommendations,
  setIncludeRecommendations,
  onGenerate, 
  isGenerating, 
  error 
}: EmptyPlanStateProps) {
  return (
    <div className="py-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2">Create Your Travel Plan</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Tell us about your trip and AI will organize your saved places into a personalized itinerary.
        </p>
      </div>

      <div className="space-y-4 max-w-sm mx-auto">
        <div className="bg-muted/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground block mb-1.5">Trip Duration</label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                data-testid="select-plan-duration"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground block mb-1.5">Group Size</label>
              <div className="flex gap-1.5">
                {PEOPLE_COUNT_OPTIONS.map(option => (
                  <button
                    key={option}
                    onClick={() => setPeopleCount(option)}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors",
                      peopleCount === option
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    )}
                    data-testid={`button-people-${option}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground block mb-1.5">Trip Type</label>
              <select
                value={tripPurpose}
                onChange={(e) => setTripPurpose(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                data-testid="select-trip-purpose"
              >
                {TRIP_PURPOSE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border/50">
            <Lightbulb className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground block">AI Suggestions</label>
                <p className="text-xs text-muted-foreground">Include restaurant & activity ideas</p>
              </div>
              <Switch
                checked={includeRecommendations}
                onCheckedChange={setIncludeRecommendations}
                data-testid="switch-recommendations"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          data-testid="button-generate-plan"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Generate Plan
            </span>
          )}
        </button>
      </div>
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
  onUpdateDayTitle: (title: string) => void;
  onUpdateBlockField: (blockIndex: number, field: string, value: string) => void;
  onRemovePlace: (blockIndex: number, placeId: number) => void;
}

const TIME_OF_DAY_OPTIONS = ['morning', 'afternoon', 'evening', 'flexible'] as const;

function DayCard({ day, dayIndex, placesMap, isEditing, onUpdateDayTitle, onUpdateBlockField, onRemovePlace }: DayCardProps) {
  const timeIcons: Record<string, React.ReactNode> = {
    morning: <Sunrise className="w-3.5 h-3.5" />,
    afternoon: <Sun className="w-3.5 h-3.5" />,
    evening: <Sunset className="w-3.5 h-3.5" />,
    flexible: <Clock className="w-3.5 h-3.5" />,
  };

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
      <div className="p-4 space-y-4">
        {day.blocks.map((block, blockIndex) => (
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
            <div className="space-y-2 pl-5">
              {block.placeIds.map((placeId) => {
                const place = placesMap.get(placeId);
                if (!place) return null;
                return (
                  <div key={placeId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 group" data-testid={`plan-place-${placeId}`}>
                    {getPhotoUrl(place.photoUrl) ? (
                      <img src={getPhotoUrl(place.photoUrl)!} alt={place.name} className="w-10 h-10 rounded-md object-cover" />
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
                        onClick={() => onRemovePlace(blockIndex, placeId)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                        data-testid={`button-remove-place-${placeId}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
        ))}
      </div>
    </div>
  );
}
