import { MOCK_COLLECTIONS } from '@/lib/mockData';
import { CollectionCard } from '@/components/CollectionCard';
import { TabBar } from '@/components/TabBar';
import { Plus } from 'lucide-react';

export default function Home() {
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
          <button className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">
        <div className="grid grid-cols-2 gap-4">
          {MOCK_COLLECTIONS.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
          
          {/* Add New Place Holder */}
          <button className="aspect-[4/5] rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all group">
            <div className="w-12 h-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-medium text-sm">Create New</span>
          </button>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
