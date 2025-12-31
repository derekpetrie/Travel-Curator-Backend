import { useRoute } from 'wouter';
import { MOCK_COLLECTIONS } from '@/lib/mockData';
import { TabBar } from '@/components/TabBar';
import { PostCard } from '@/components/PostCard';
import { PlaceCard } from '@/components/PlaceCard';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { ChevronLeft, Share2, Map, Grid, List, MoreHorizontal } from 'lucide-react';
import { Link } from 'wouter';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function CollectionDetail() {
  const [, params] = useRoute('/collection/:id');
  const collection = MOCK_COLLECTIONS.find(c => c.id === params?.id);
  const [activeTab, setActiveTab] = useState<'posts' | 'places' | 'map'>('posts');

  if (!collection) {
    return <div className="p-8 text-center">Collection not found</div>;
  }

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header Image */}
      <div className="relative h-64 w-full">
        <img 
          src={collection.thumbnail} 
          alt={collection.title} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background" />
        
        {/* Nav Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 pt-safe-top flex justify-between items-center text-white">
          <Link href="/">
            <a className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </a>
          </Link>
          <div className="flex gap-3">
             <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
             <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 transform translate-y-8">
           <div className="bg-card shadow-xl rounded-xl p-5 border border-border/50">
             <h1 className="font-heading text-2xl font-bold mb-1">{collection.title}</h1>
             <p className="text-muted-foreground text-sm font-medium">
               {collection.itemCount} items • Created on {collection.createdAt}
             </p>
           </div>
        </div>
      </div>

      {/* Spacer for the floating title card */}
      <div className="h-16" />

      {/* Tabs */}
      <div className="px-6 mt-4 mb-6">
        <div className="flex p-1 bg-muted rounded-lg">
          <button 
            onClick={() => setActiveTab('posts')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-md transition-all",
              activeTab === 'posts' ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Grid className="w-4 h-4" />
            Posts
          </button>
          <button 
            onClick={() => setActiveTab('places')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-md transition-all",
              activeTab === 'places' ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-4 h-4" />
            Places
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-md transition-all",
              activeTab === 'map' ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Map className="w-4 h-4" />
            Map
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {collection.posts.length > 0 ? (
              collection.posts.map(post => <PostCard key={post.id} post={post} />)
            ) : (
              <EmptyState type="posts" />
            )}
          </div>
        )}

        {activeTab === 'places' && (
          <div className="space-y-4">
            {collection.places.length > 0 ? (
              collection.places.map(place => <PlaceCard key={place.id} place={place} />)
            ) : (
              <EmptyState type="places" />
            )}
          </div>
        )}

        {activeTab === 'map' && (
           <div className="h-[400px]">
             <MapPlaceholder />
           </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
      <p className="mb-2">No {type} yet.</p>
      <button className="text-primary font-bold text-sm">Add your first post</button>
    </div>
  );
}
