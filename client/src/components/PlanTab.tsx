import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlan, generatePlan, deletePlan, updatePlan, getPhotoUrl, type GeneratePlanOptions } from '@/lib/api';
import type { PlaceWithEnrichment, PlanContent, PlanBlock, RecommendedPlace } from '@shared/schema';
import { Sparkles, Loader2, AlertCircle, Clock, MapPin, Sun, Sunrise, Sunset, Calendar, RefreshCw, Trash2, Pencil, Check, X, Users, Target, Lightbulb, Star, Navigation, Globe, Phone, ChevronDown, ChevronUp } from 'lucide-react';
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

interface PlanPlaceCardProps {
  place: PlaceWithEnrichment | RecommendedPlace;
  isRecommendation: boolean;
  recommendationStatus?: string;
  isEditing: boolean;
  onRemove: () => void;
}

function PlanPlaceCard({ place, isRecommendation, recommendationStatus, isEditing, onRemove }: PlanPlaceCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const name = place.name;
  const category = place.category;
  const location = ('addressFull' in place && place.addressFull) || 
    [place.city, place.country].filter(Boolean).join(', ') || 
    'Unknown location';
  const rating = ('rating' in place && place.rating) ? place.rating : null;
  const priceLevel = ('priceLevel' in place && place.priceLevel) ? place.priceLevel : null;
  const hoursDisplay = ('hoursDisplay' in place && place.hoursDisplay) ? place.hoursDisplay : null;
  const website = ('website' in place && place.website) ? place.website : null;
  const phone = ('phone' in place && place.phone) ? place.phone : null;
  const photoUrl = ('photoUrl' in place && place.photoUrl) ? place.photoUrl : null;
  const lat = ('lat' in place && place.lat) ? place.lat : null;
  const lng = ('lng' in place && place.lng) ? place.lng : null;
  const description = ('description' in place && place.description) ? place.description : null;
  const whyRecommended = ('whyRecommended' in place && place.whyRecommended) ? place.whyRecommended : null;
  const placeId = ('id' in place && typeof place.id === 'number') ? place.id : null;
  
  const hasDetails = website || phone || hoursDisplay || description || whyRecommended;
  
  return (
    <div 
      className={cn(
        "rounded-[14px] bg-white border shadow-sm overflow-hidden group",
        isRecommendation ? "border-primary/30 bg-primary/5" : "border-neutral-200"
      )}
      data-testid={placeId ? `plan-place-${placeId}` : `plan-recommendation-${name}`}
    >
      <div className="flex">
        {getPhotoUrl(photoUrl) ? (
          <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
            <img 
              src={getPhotoUrl(photoUrl)!} 
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-20 h-20 flex-shrink-0 bg-neutral-100 flex items-center justify-center">
            {isRecommendation ? (
              <Sparkles className="w-6 h-6 text-primary/50" />
            ) : (
              <MapPin className="w-6 h-6 text-neutral-300" />
            )}
          </div>
        )}
        
        <div className="flex-1 p-2.5 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {category && (
                    <span className="px-1.5 py-0 rounded-full bg-coral-500/10 text-coral-500 text-[9px] font-bold uppercase tracking-wider">
                      {category}
                    </span>
                  )}
                  {isRecommendation && (
                    <span className="px-1.5 py-0 rounded-full bg-primary/20 text-primary text-[9px] font-bold uppercase tracking-wider">
                      AI Pick
                    </span>
                  )}
                </div>
                <h3 className="font-heading text-sm font-bold text-gunmetal-900 truncate">
                  {name}
                </h3>
              </div>
              
              <div className="flex items-center gap-1 flex-shrink-0">
                {lat && lng && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-gunmetal-500 hover:bg-coral-500/10 hover:text-coral-500 transition-colors"
                    data-testid={`navigate-plan-place-${placeId || name}`}
                  >
                    <Navigation className="w-3 h-3" />
                  </a>
                )}
                {isEditing && !isRecommendation && (
                  <button
                    onClick={onRemove}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    data-testid={`remove-plan-place-${placeId}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center text-gunmetal-500 text-xs mt-0.5">
              <MapPin className="w-3 h-3 mr-0.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 text-xs text-gunmetal-500">
              {rating && (
                <div className="flex items-center gap-0.5 font-medium text-gunmetal-700">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {rating.toFixed(1)}
                </div>
              )}
              {priceLevel && (
                <span className="font-medium">
                  {'$'.repeat(priceLevel)}
                  <span className="text-gunmetal-300">{'$'.repeat(4 - priceLevel)}</span>
                </span>
              )}
            </div>
            
            {hasDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-coral-500 hover:text-coral-600 flex items-center gap-0.5"
                data-testid={`expand-plan-place-${placeId || name}`}
              >
                {expanded ? 'Less' : 'More'}
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
      </div>
      
      {expanded && hasDetails && (
        <div className="border-t border-neutral-100 px-3 py-2 bg-neutral-50 space-y-2">
          {(description || whyRecommended) && (
            <p className="text-xs text-gunmetal-600">
              {whyRecommended || description}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-gunmetal-600">
            {hoursDisplay && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gunmetal-400" />
                <span>{hoursDisplay}</span>
              </div>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-coral-500 hover:text-coral-600"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</span>
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-1 text-coral-500 hover:text-coral-600"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{phone}</span>
              </a>
            )}
          </div>
        </div>
      )}
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
      isRecommendation?: boolean;
      recommendationStatus?: string;
      recommendedPlace?: RecommendedPlace;
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
              {block.isRecommendation && block.recommendedPlace ? (
                <PlanPlaceCard
                  key={block.id}
                  place={block.recommendedPlace}
                  isRecommendation={true}
                  recommendationStatus={block.recommendationStatus}
                  isEditing={isEditing}
                  onRemove={() => {}}
                />
              ) : (
                block.placeIds.map((placeId) => {
                  const place = placesMap.get(placeId);
                  if (!place) return null;
                  return (
                    <PlanPlaceCard
                      key={placeId}
                      place={place}
                      isRecommendation={false}
                      isEditing={isEditing}
                      onRemove={() => onRemovePlace(blockIndex, placeId)}
                    />
                  );
                })
              )}
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
