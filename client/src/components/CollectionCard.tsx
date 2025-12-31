import { Collection } from '@/lib/mockData';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Link href={`/collection/${collection.id}`}>
      <a className="group block relative overflow-hidden rounded-xl aspect-[4/5] bg-muted shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
        <img 
          src={collection.thumbnail} 
          alt={collection.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <h3 className="font-heading text-xl font-bold mb-1 line-clamp-2 leading-tight">
            {collection.title}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-white/80 text-sm font-medium">
              {collection.itemCount} items
            </span>
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}
