import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { fetchPublicVenturr, getPhotoUrl } from '@/lib/api';
import { Loader2, MapPin, ArrowLeft, Share2, Star } from 'lucide-react';
import { PlaceMap } from '@/components/PlaceMap';
import { useState } from 'react';

export default function PublicVenturr() {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);
  
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const mapPlaces = places.map(p => ({
    id: p.id,
    name: p.name,
    city: p.city,
    country: p.country,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    photoUrl: p.photoUrl,
    rating: p.rating,
  }));

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
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <div className="px-4 py-6 text-center">
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

        {places.length > 0 && (
          <div className="h-64 mx-4 rounded-xl overflow-hidden border border-[#E2E8F0]">
            <PlaceMap places={mapPlaces as any} />
          </div>
        )}

        <div className="px-4 py-6 space-y-3">
          {places.map((place) => (
            <div
              key={place.id}
              className="flex items-center gap-4 p-4 bg-white border border-[#E2E8F0] rounded-lg"
              data-testid={`place-card-${place.id}`}
            >
              {getPhotoUrl(place.photoUrl) ? (
                <img
                  src={getPhotoUrl(place.photoUrl)!}
                  alt={place.name}
                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 bg-[#F25F5C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-[#F25F5C]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[#1F2933] truncate">{place.name}</h4>
                <p className="text-xs text-[#6B7280]">
                  {[place.city, place.country].filter(Boolean).join(', ')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {place.category && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F25F5C]/10 text-[#F25F5C] text-[10px] font-bold">
                      {place.category}
                    </span>
                  )}
                  {place.rating && (
                    <span className="text-xs text-[#6B7280] flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {place.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 pt-4 pb-8 text-center border-t border-[#E2E8F0]">
          <p className="text-sm text-[#6B7280] mb-3">Discover and save travel spots with Venturr</p>
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
