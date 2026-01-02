import { useRoute } from 'wouter';
import { TabBar } from '@/components/TabBar';
import { PostCard } from '@/components/PostCard';
import { PlaceCard } from '@/components/PlaceCard';
import { CollectionMap } from '@/components/CollectionMap';
import { CoverCustomizer } from '@/components/CoverCustomizer';
import { ChevronLeft, Share2, Map, Grid, List, ImagePlus, Loader2, Sparkles, Pencil, Check, X } from 'lucide-react';
import { Link } from 'wouter';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollection, fetchPosts, fetchPlaces, updateCollectionCover, generateSummary, renameCollection } from '@/lib/api';

export default function CollectionDetail() {
  const [, params] = useRoute('/collection/:id');
  const collectionId = parseInt(params?.id || '0');
  const [activeTab, setActiveTab] = useState<'posts' | 'places' | 'map'>('posts');
  const [showCoverCustomizer, setShowCoverCustomizer] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
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

  const handleSaveCover = async (coverImage: string | null, coverGradient: string | null) => {
    await updateCollectionCover(collectionId, coverImage, coverGradient);
    queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    queryClient.invalidateQueries({ queryKey: ['collections'] });
  };

  const summaryMutation = useMutation({
    mutationFn: () => generateSummary(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameCollection(collectionId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setIsEditingTitle(false);
    },
  });

  const startEditingTitle = () => {
    setEditedTitle(collection?.title || '');
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const saveTitle = () => {
    if (editedTitle.trim() && editedTitle.trim() !== collection?.title) {
      renameMutation.mutate(editedTitle.trim());
    } else {
      setIsEditingTitle(false);
    }
  };

  const cancelEditingTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle('');
  };

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
    return <div className="p-8 text-center">Collection not found</div>;
  }

  const coverImage = collection.coverImage || posts[0]?.thumbnailUrl;
  const coverGradient = collection.coverGradient || 'FF385C, FF6B8A';
  const gradientParts = coverGradient.split(',').map(s => s.trim());
  const createdAt = new Date(collection.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header Image */}
      <div className="relative h-64 w-full">
        {coverImage ? (
          <img 
            src={coverImage} 
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
          <div className="flex gap-3">
             <button 
               onClick={() => setShowCoverCustomizer(true)}
               className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors" 
               data-testid="button-customize-cover"
             >
              <ImagePlus className="w-5 h-5" />
            </button>
             <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors" data-testid="button-share">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title Area */}
        <div className="absolute bottom-0 left-0 right-0 p-6 transform translate-y-8">
           <div className="bg-card shadow-xl rounded-xl p-5 border border-border/50">
             {/* Title Row */}
             <div className="flex items-start justify-between gap-2 mb-1">
               {isEditingTitle ? (
                 <div className="flex-1 flex items-center gap-2">
                   <input
                     ref={titleInputRef}
                     type="text"
                     value={editedTitle}
                     onChange={(e) => setEditedTitle(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') saveTitle();
                       if (e.key === 'Escape') cancelEditingTitle();
                     }}
                     className="flex-1 font-heading text-2xl font-bold bg-transparent border-b-2 border-primary outline-none"
                     data-testid="input-collection-title"
                   />
                   <button
                     onClick={saveTitle}
                     disabled={renameMutation.isPending}
                     className="p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
                     data-testid="button-save-title"
                   >
                     {renameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                   </button>
                   <button
                     onClick={cancelEditingTitle}
                     className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                     data-testid="button-cancel-title"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               ) : (
                 <>
                   <h1 className="font-heading text-2xl font-bold" data-testid="text-collection-title">{collection.title}</h1>
                   <button
                     onClick={startEditingTitle}
                     className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                     data-testid="button-edit-title"
                   >
                     <Pencil className="w-4 h-4" />
                   </button>
                 </>
               )}
             </div>
             
             {/* Info Row */}
             <p className="text-muted-foreground text-sm font-medium" data-testid="text-collection-info">
               {posts.length} {posts.length === 1 ? 'post' : 'posts'} • {places.length} {places.length === 1 ? 'place' : 'places'} • {createdAt}
             </p>
             
             {/* Edit Cover Button */}
             <button
               onClick={() => setShowCoverCustomizer(true)}
               className="mt-3 w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
               data-testid="button-edit-cover"
             >
               <ImagePlus className="w-4 h-4" />
               Edit Cover
             </button>
             
             {/* Summary */}
             {(collection.summary || summaryMutation.isPending) && (
               <div className="mt-3 pt-3 border-t border-border/50">
                 {summaryMutation.isPending ? (
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                     <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                     <span>Generating itinerary...</span>
                   </div>
                 ) : (
                   <p className="text-sm text-foreground/80 italic" data-testid="text-collection-summary">
                     {collection.summary}
                   </p>
                 )}
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Spacer for the floating title card */}
      <div className={cn("transition-all", collection.summary || summaryMutation.isPending ? "h-36" : "h-28")} />

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
              posts.map(post => <PostCard key={post.id} post={post} />)
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
              places.map(place => <PlaceCard key={place.id} place={place} />)
            ) : (
              <EmptyState type="places" />
            )}
          </div>
        )}

        {activeTab === 'map' && (
           <div className="h-[500px]">
             <CollectionMap places={places} />
           </div>
        )}
      </div>

      <TabBar />

      <CoverCustomizer
        isOpen={showCoverCustomizer}
        onClose={() => setShowCoverCustomizer(false)}
        onSave={handleSaveCover}
        currentCoverImage={collection.coverImage}
        currentCoverGradient={collection.coverGradient}
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
