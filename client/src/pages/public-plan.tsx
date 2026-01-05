import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { fetchPublicPlan } from '@/lib/api';
import type { PlanContent, PlaceWithEnrichment } from '@shared/schema';
import { Loader2, Clock, MapPin, Sun, Sunrise, Sunset, Calendar, ArrowLeft, Share2 } from 'lucide-react';

export default function PublicPlan() {
  const { slug } = useParams<{ slug: string }>();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['publicPlan', slug],
    queryFn: () => fetchPublicPlan(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="w-8 h-8 animate-spin text-[#F25F5C]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] px-4">
        <div className="text-center">
          <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-[#1F2933] mb-2">Plan not found</h1>
          <p className="text-[#6B7280]">This plan may have been removed or is no longer shared.</p>
        </div>
      </div>
    );
  }

  const { plan, places, collectionTitle } = data;
  const content = plan.content as PlanContent;
  const placesMap = new Map(places.map((p: PlaceWithEnrichment) => [p.venturrPlaceId || p.id, p]));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 bg-white border-b border-[#E2E8F0] z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <a 
            href="/" 
            className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2933] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Venturr</span>
          </a>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors"
            data-testid="button-copy-link"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1F2933]" data-testid="text-plan-title">
            {collectionTitle}
          </h1>
          {content.overview?.summary && (
            <p className="mt-2 text-[#6B7280]" data-testid="text-plan-summary">
              {content.overview.summary}
            </p>
          )}
          {content.days.length > 0 && (
            <p className="mt-1 text-sm text-[#6B7280]">
              {content.days.length} {content.days.length === 1 ? 'day' : 'days'} itinerary
            </p>
          )}
        </div>

        {content.overview?.travelTips && content.overview.travelTips.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-[#F25F5C]/10 to-[#F25F5C]/20 rounded-xl border border-[#F25F5C]/30">
            <p className="text-xs font-medium text-[#6B7280] mb-1.5">Travel Tips</p>
            <ul className="text-sm text-[#3A4753] space-y-1">
              {content.overview.travelTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#F25F5C] mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.days.map((day) => (
          <PublicDayCard key={day.dayNumber} day={day} placesMap={placesMap} />
        ))}

        {content.notes && (
          <div className="p-4 bg-[#F8FAFC] rounded-xl text-sm text-[#6B7280] italic border border-[#E2E8F0]">
            {content.notes}
          </div>
        )}

        <div className="pt-8 pb-4 text-center border-t border-[#E2E8F0]">
          <p className="text-sm text-[#6B7280] mb-3">Plan your own trips with Venturr</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-[#F25F5C] text-white font-bold rounded-lg hover:bg-[#F25F5C]/90 transition-colors"
            data-testid="button-create-venturr"
          >
            Create Your Venturr
          </a>
        </div>
      </main>
    </div>
  );
}

interface PublicDayCardProps {
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

function PublicDayCard({ day, placesMap }: PublicDayCardProps) {
  const timeIcons: Record<string, React.ReactNode> = {
    morning: <Sunrise className="w-3.5 h-3.5" />,
    afternoon: <Sun className="w-3.5 h-3.5" />,
    evening: <Sunset className="w-3.5 h-3.5" />,
    flexible: <Clock className="w-3.5 h-3.5" />,
  };

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden" data-testid={`card-day-${day.dayNumber}`}>
      <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#F25F5C]" />
        <span className="font-bold text-[#1F2933]">Day {day.dayNumber}</span>
        {day.title && <span className="text-[#6B7280]">— {day.title}</span>}
      </div>
      <div className="p-4 space-y-4">
        {day.blocks.map((block) => (
          <div key={block.id} className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#6B7280]">{timeIcons[block.timeOfDay || 'flexible'] || timeIcons.flexible}</span>
              <span className="font-medium text-[#3A4753] capitalize">{block.timeOfDay || 'flexible'}</span>
              {block.title && <span className="text-[#6B7280]">• {block.title}</span>}
            </div>
            <div className="space-y-2 pl-5">
              {block.placeIds.map((placeId) => {
                const place = placesMap.get(placeId);
                if (!place) return null;
                return (
                  <div key={placeId} className="flex items-center gap-3 p-2 rounded-lg bg-[#F8FAFC]" data-testid={`plan-place-${placeId}`}>
                    {place.photoUrl ? (
                      <img src={place.photoUrl} alt={place.name} className="w-10 h-10 rounded-md object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-[#E2E8F0] flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-[#6B7280]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#1F2933] truncate">{place.name}</p>
                      <p className="text-xs text-[#6B7280] truncate">
                        {place.city}{place.country ? `, ${place.country}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {block.notes && (
              <p className="text-xs text-[#6B7280] italic pl-5">{block.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
