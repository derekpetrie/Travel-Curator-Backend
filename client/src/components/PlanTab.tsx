import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlan, generatePlan, deletePlan } from '@/lib/api';
import type { PlaceWithEnrichment, PlanContent } from '@shared/schema';
import { Sparkles, Loader2, AlertCircle, Clock, MapPin, Sun, Sunrise, Sunset, Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PlanTabProps {
  collectionId: number;
  places: PlaceWithEnrichment[];
  placesLoading: boolean;
}

export function PlanTab({ collectionId, places, placesLoading }: PlanTabProps) {
  const queryClient = useQueryClient();
  const [durationDays, setDurationDays] = useState(3);

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

  const plan = planData?.plan;
  const isStale = planData?.isStale;
  const isGenerating = plan?.status === 'generating' || generateMutation.isPending;
  const hasFailed = plan?.status === 'failed';
  const isReady = plan?.status === 'ready';

  const placesMap = new Map(places.map(p => [p.venturrPlaceId || p.id, p]));

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

  const content = plan.content as PlanContent;

  return (
    <div className="space-y-4">
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
        <div className="p-4 bg-gradient-to-r from-coral-50 to-coral-100/50 rounded-xl border border-coral-200">
          <p className="text-foreground/90" data-testid="text-plan-summary">
            {content.overview.summary}
          </p>
          {content.overview.travelTips && content.overview.travelTips.length > 0 && (
            <div className="mt-3 pt-3 border-t border-coral-200/50">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Tips</p>
              <ul className="text-sm text-foreground/80 space-y-1">
                {content.overview.travelTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-coral-500 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {content.days.map((day) => (
        <DayCard key={day.dayNumber} day={day} placesMap={placesMap} />
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
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-coral-100 to-coral-200 flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-coral-500" />
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
        className="px-6 py-3 bg-coral-500 text-white font-bold rounded-lg hover:bg-coral-600 transition-colors disabled:opacity-50"
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
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-coral-100 to-coral-200 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-coral-500 animate-spin" />
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
  placesMap: Map<number, PlaceWithEnrichment>;
}

function DayCard({ day, placesMap }: DayCardProps) {
  const timeIcons: Record<string, React.ReactNode> = {
    morning: <Sunrise className="w-3.5 h-3.5" />,
    afternoon: <Sun className="w-3.5 h-3.5" />,
    evening: <Sunset className="w-3.5 h-3.5" />,
    flexible: <Clock className="w-3.5 h-3.5" />,
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden" data-testid={`card-day-${day.dayNumber}`}>
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
        <Calendar className="w-4 h-4 text-coral-500" />
        <span className="font-bold text-foreground">Day {day.dayNumber}</span>
        {day.title && <span className="text-muted-foreground">— {day.title}</span>}
      </div>
      <div className="p-4 space-y-4">
        {day.blocks.map((block) => (
          <div key={block.id} className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{timeIcons[block.timeOfDay || 'flexible'] || timeIcons.flexible}</span>
              <span className="font-medium text-foreground/80 capitalize">{block.timeOfDay || 'flexible'}</span>
              {block.title && <span className="text-muted-foreground">• {block.title}</span>}
            </div>
            <div className="space-y-2 pl-5">
              {block.placeIds.map((placeId) => {
                const place = placesMap.get(placeId);
                if (!place) return null;
                return (
                  <div key={placeId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50" data-testid={`plan-place-${placeId}`}>
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
                  </div>
                );
              })}
            </div>
            {block.notes && (
              <p className="text-xs text-muted-foreground italic pl-5">{block.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
