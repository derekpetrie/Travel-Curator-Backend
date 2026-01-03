import { useRoute } from 'wouter';
import { TabBar } from '@/components/TabBar';
import { PostCard } from '@/components/PostCard';
import { PlaceCard } from '@/components/PlaceCard';
import { VenturrMap } from '@/components/VenturrMap';
import { EditVenturrDrawer } from '@/components/EditVenturrDrawer';
import { ChevronLeft, Share2, Map, Grid, List, Loader2, Sparkles, Pencil } from 'lucide-react';
import { Link } from 'wouter';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollection, fetchPosts, fetchPlaces, generateSummary, renameCollection, deletePost } from '@/lib/api';

export default function VenturrDetail() {
  const [, params] = useRoute('/venturr/:id');
  const collectionId = parseInt(params?.id || '0');
  const [activeTab, setActiveTab] = useState<'posts' | 'places' | 'map'>('posts');
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const queryClient = useQueryClient();

  const { data: collection, isLoading: collectionLoading } = useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () => fetchCollection(collectionId),
    enabled: !!collectionId,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['posts', collectionId],
    queryFn: () => fetchPosts(collectionId),
    enabled: !!collectionId,
  });

  const { data: places = [], isLoading: placesLoading } = useQuery({
    queryKey: ['places', collectionId],
    queryFn: () => fetchPlaces(collectionId),
    enabled: !!collectionId,
  });

  // Invalidate collections when leaving this page to ensure home shows updated covers
  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    };
  }, [queryClient]);

  const summaryMutation = useMutation({
    mutationFn: () => generateSummary(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });

  const handleSaveTitle = async (title: string) => {
    await renameCollection(collectionId, title);
    queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    queryClient.invalidateQueries({ queryKey: ['collections'] });
  };

  const deletePostMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['places', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });

  // Auto-generate summary if there are places but no summary
  useEffect(() => {
    if (collection && !collection.summary && places.length > 0 && !summaryMutation.isPending) {
      summaryMutation.mutate();
    }
  }, [collection?.id, places.length]);

  if (collectionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!collection) {
    return <div className="p-8 text-center">Venturr not found</div>;
  }

  // Cover: use first post's thumbnail, otherwise show gradient
  const firstPostThumbnail = posts.length > 0 ? posts[0]?.thumbnailUrl : null;
  const coverGradient = collection.coverGradient || '#FF385C, #FF6B8A';
  // Normalize gradient parts to ensure they have # prefix
  const gradientParts = coverGradient.split(',').map(s => {
    const color = s.trim();
    return color.startsWith('#') ? color : `#${color}`;
  });
  const createdAt = new Date(collection.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header Image */}
      <div className="relative h-64 w-full">
        {firstPostThumbnail ? (
          <img 
            src={firstPostThumbnail} 
            alt={collection.title} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div 
            className="w-full h-full"
            style={{ 
              background: `linear-gradient(135deg, ${gradientParts[0] || '#FF385C'} 0%, ${gradientParts[1] || '#FF6B8A'} 100%)` 
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-background" />
        
        {/* Nav Bar */}
        <div className="absolute top-0 left-0 right-0 p-6 pt-safe-top flex justify-between items-center text-white">
          <Link href="/" className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors" data-testid="button-back">
            <ChevronLeft className="w-6 h-6" />
          </Link>
        </div>

        {/* Title Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 transform translate-y-8">
           <div className="bg-card shadow-xl rounded-xl p-5 border border-border/50">
             <div className="flex items-start justify-between gap-3">
               <div className="flex-1 min-w-0">
                 <h1 className="font-heading text-2xl font-bold mb-1" data-testid="text-venturr-title">{collection.title}</h1>
                 <p className="text-muted-foreground text-sm font-medium" data-testid="text-venturr-info">
                   {posts.length} {posts.length === 1 ? 'post' : 'posts'} • {places.length} {places.length === 1 ? 'place' : 'places'} • {createdAt}
                 </p>
               </div>
               <div className="flex gap-2 flex-shrink-0">
                 <button 
                   onClick={() => setShowEditDrawer(true)}
                   className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors text-foreground" 
                   data-testid="button-edit-venturr"
                 >
                   <Pencil className="w-4 h-4" />
                 </button>
                 <button 
                   className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors text-foreground" 
                   data-testid="button-share"
                 >
                   <Share2 className="w-4 h-4" />
                 </button>
               </div>
             </div>
             {(collection.summary || summaryMutation.isPending) && (
               <div className="mt-3 pt-3 border-t border-border/50">
                 {summaryMutation.isPending ? (
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                     <span>Generating itinerary...</span>
                   </div>
                 ) : (
                   <p className="text-sm text-foreground/80 italic" data-testid="text-venturr-summary">
                     {collection.summary}
                   </p>
                 )}
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Spacer for the floating title card */}
      <div className={cn("transition-all", collection.summary || summaryMutation.isPending ? "h-24" : "h-16")} />

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
            {postsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : posts.length > 0 ? (
              posts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onDelete={(id) => deletePostMutation.mutate(id)}
                />
              ))
            ) : (
              <EmptyState type="posts" />
            )}
          </div>
        )}

        {activeTab === 'places' && (
          <div className="space-y-4">
            {placesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : places.length > 0 ? (
              places.map(place => <PlaceCard key={place.id} place={place} collectionId={collectionId} />)
            ) : (
              <EmptyState type="places" />
            )}
          </div>
        )}

        {activeTab === 'map' && (
           <div className="h-[500px]">
             <VenturrMap places={places} />
           </div>
        )}
      </div>

      <TabBar />

      <EditVenturrDrawer
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}
        venturr={collection}
        onSaveTitle={handleSaveTitle}
      />
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
