import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { fetchPublicVenturr, getPhotoUrl } from '@/lib/api';
import type { PlaceWithEnrichment } from '@shared/schema';
import { Loader2, MapPin, ArrowLeft, Share2, Star, Clock, ExternalLink } from 'lucide-react';
import { PlaceMap } from '@/components/PlaceMap';
import { useState } from 'react';

export default function PublicVenturr() {
  const { slug } = useParams<{ slug: string }>();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['publicVenturr', slug],
    queryFn: () => fetchPublicVenturr(slug!),
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
          <h1 className="text-2xl font-bold text-[#1F2933] mb-2">Venturr not found</h1>
          <p className="text-[#6B7280]">This Venturr may have been removed or is no longer shared.</p>
        </div>
      </div>
    );
  }

  const { collection, places } = data;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
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

      {collection.coverImage && (
        <div 
          className="h-48 bg-cover bg-center"
          style={{ 
            backgroundImage: collection.coverGradient 
              ? collection.coverGradient 
              : `url(${getPhotoUrl(collection.coverImage)})` 
          }}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#1F2933]" data-testid="text-venturr-title">
            {collection.title}
          </h1>
          {collection.summary && (
            <p className="mt-2 text-[#6B7280]" data-testid="text-venturr-summary">
              {collection.summary}
            </p>
          )}
          <p className="mt-1 text-sm text-[#6B7280]">
            {places.length} {places.length === 1 ? 'place' : 'places'}
          </p>
        </div>

        <div className="flex gap-2 justify-center mb-4">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === 'list' 
                ? 'bg-[#1F2933] text-white' 
                : 'bg-white border border-[#E2E8F0] text-[#6B7280] hover:bg-[#F8FAFC]'
            }`}
            data-testid="button-view-list"
          >
            List
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === 'map' 
                ? 'bg-[#1F2933] text-white' 
                : 'bg-white border border-[#E2E8F0] text-[#6B7280] hover:bg-[#F8FAFC]'
            }`}
            data-testid="button-view-map"
          >
            Map
          </button>
        </div>

        {viewMode === 'map' ? (
          <div className="h-[400px] rounded-xl overflow-hidden border border-[#E2E8F0]">
            <PlaceMap 
              places={places} 
              selectedPlaceId={null}
              onPlaceSelect={() => {}}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {places.map((place) => (
              <PublicPlaceCard key={place.id} place={place} />
            ))}
          </div>
        )}

        <div className="pt-8 pb-4 text-center border-t border-[#E2E8F0]">
          <p className="text-sm text-[#6B7280] mb-3">Discover more places with Venturr</p>
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

function PublicPlaceCard({ place }: { place: PlaceWithEnrichment }) {
  const photoUrl = getPhotoUrl(place.photoUrl);
  
  return (
    <div 
      className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex gap-3"
      data-testid={`card-place-${place.id}`}
    >
      {photoUrl ? (
        <img 
          src={photoUrl} 
          alt={place.name} 
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-[#F8FAFC] flex items-center justify-center flex-shrink-0">
          <MapPin className="w-6 h-6 text-[#6B7280]" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[#1F2933] truncate">{place.name}</h3>
        <p className="text-sm text-[#6B7280] truncate">
          {place.city}{place.country ? `, ${place.country}` : ''}
        </p>
        
        <div className="flex items-center gap-3 mt-2 text-xs text-[#6B7280]">
          {place.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {place.rating.toFixed(1)}
            </span>
          )}
          {place.hoursDisplay && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {place.hoursDisplay}
            </span>
          )}
        </div>
        
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-[#F25F5C] hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Website
          </a>
        )}
      </div>
    </div>
  );
}
