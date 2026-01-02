import { VenturrCard } from '@/components/VenturrCard';
import { TabBar } from '@/components/TabBar';
import { Plus, Loader2, ArrowUpDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollections, createCollection, fetchPosts } from '@/lib/api';
import { useState, useMemo } from 'react';
import type { Collection } from '@shared/schema';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SortOption = 'lastEdited' | 'created' | 'name';

const SORT_LABELS: Record<SortOption, string> = {
  lastEdited: 'Last Edited',
  created: 'Date Created',
  name: 'Name',
};

export default function Home() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortOption>('lastEdited');

  const { data: collections, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = prompt('Enter Venturr name:');
      if (!title) return null;
      return createCollection(title);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });

  // Enhance collections with item count and first post thumbnail
  const collectionsWithCounts = useQuery({
    queryKey: ['collectionsWithCounts', collections],
    queryFn: async () => {
      if (!collections) return [];
      
      const enhanced = await Promise.all(
        collections.map(async (collection: Collection) => {
          try {
            const posts = await fetchPosts(collection.id);
            const firstPostThumbnail = posts.length > 0 ? posts[0].thumbnailUrl : null;
            return {
              ...collection,
              itemCount: posts.length,
              firstPostThumbnail,
            };
          } catch {
            return {
              ...collection,
              itemCount: 0,
              firstPostThumbnail: null,
            };
          }
        })
      );
      return enhanced;
    },
    enabled: !!collections,
  });

  // Sort collections based on selected option
  const sortedCollections = useMemo(() => {
    const data = collectionsWithCounts.data || [];
    return [...data].sort((a: any, b: any) => {
      switch (sortBy) {
        case 'lastEdited':
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [collectionsWithCounts.data, sortBy]);

  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      {/* Header */}
      <header className="px-6 pt-8 pb-4 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-transparent transition-all">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Welcome back</p>
            <h1 className="font-heading text-3xl font-extrabold text-foreground tracking-tight">
              My Venturrs
            </h1>
          </div>
          <button 
            onClick={() => createMutation.mutate()}
            data-testid="button-create-venturr-header"
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
          >
            {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">
        {/* Sort Controls */}
        <div className="flex justify-end mb-4">
          <DropdownMenu modal={true}>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="sort-dropdown-trigger"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>{SORT_LABELS[sortBy]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <DropdownMenuItem
                  key={option}
                  onSelect={() => setSortBy(option)}
                  className={sortBy === option ? 'bg-primary/10 text-primary' : ''}
                  data-testid={`sort-option-${option}`}
                >
                  {SORT_LABELS[option]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {sortedCollections.map((venturr: any) => (
              <VenturrCard key={venturr.id} venturr={venturr} />
            ))}
            
            {/* Add New Place Holder */}
            <button 
              onClick={() => createMutation.mutate()}
              data-testid="button-create-venturr"
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
