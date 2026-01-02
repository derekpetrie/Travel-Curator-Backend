import { CollectionCard } from '@/components/CollectionCard';
import { TabBar } from '@/components/TabBar';
import { Plus, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollections, createCollection, fetchPosts } from '@/lib/api';
import { useState } from 'react';
import type { Collection } from '@shared/schema';

export default function Home() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = prompt('Enter collection name:');
      if (!title) return null;
      return createCollection(title);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  // Enhance collections with item count from posts
  const collectionsWithCounts = useQuery({
    queryKey: ['collectionsWithCounts', collections],
    queryFn: async () => {
      if (!collections) return [];
      
      const enhanced = await Promise.all(
        collections.map(async (collection: Collection) => {
          try {
            const posts = await fetchPosts(collection.id);
            return {
              ...collection,
              itemCount: posts.length,
            };
          } catch {
            return {
              ...collection,
              itemCount: 0,
            };
          }
        })
      );
      return enhanced;
    },
    enabled: !!collections,
  });

  const displayCollections = collectionsWithCounts.data || [];

  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-transparent transition-all">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Welcome back</p>
            <h1 className="font-heading text-3xl font-extrabold text-foreground tracking-tight">
              My Collections
            </h1>
          </div>
          <button 
            onClick={() => createMutation.mutate()}
            data-testid="button-create-collection-header"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {displayCollections.map((collection: any) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
            
            {/* Add New Place Holder */}
            <button 
              onClick={() => createMutation.mutate()}
              data-testid="button-create-collection"
              className="aspect-[4/5] rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                {createMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              </div>
              <span className="font-medium text-sm">Create New</span>
            </button>
          </div>
        )}
      </main>

      <TabBar />
    </div>
  );
}
