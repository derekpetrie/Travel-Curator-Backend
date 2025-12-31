import type { Collection } from '@shared/schema';
import { Link } from 'wouter';
import { ArrowRight, MapPin } from 'lucide-react';

interface CollectionCardProps {
  collection: Collection & { itemCount?: number };
}

function parseGradient(gradient: string | null | undefined): { from: string; to: string } {
  if (!gradient) return { from: '#FF385C', to: '#FF6B8A' };
  const parts = gradient.split(',').map(s => s.trim());
  return { from: parts[0] || '#FF385C', to: parts[1] || '#FF6B8A' };
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const gradient = parseGradient(collection.coverGradient);
  
  return (
    <Link href={`/collection/${collection.id}`} className="group block relative overflow-hidden rounded-xl aspect-[4/5] bg-muted shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
      {collection.coverImage ? (
        <img 
          src={collection.coverImage} 
          alt={collection.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div 
          className="w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
        >
          <MapPin className="w-12 h-12 text-white/80" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <h3 className="font-heading text-xl font-bold mb-1 line-clamp-2 leading-tight">
          {collection.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-white/80 text-sm font-medium">
            {collection.itemCount ?? 0} items
          </span>
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </Link>
  );
}
