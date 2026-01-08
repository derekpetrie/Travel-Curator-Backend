import { TabBar } from '@/components/TabBar';
import { Sparkles, Users, Heart, MapPin } from 'lucide-react';

export default function Inspo() {
  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      <header className="px-6 pt-8 pb-4 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-transparent">
        <h1 className="font-heading text-3xl font-extrabold text-foreground tracking-tight">
          Inspo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Discover what others are planning</p>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <h2 className="text-xl font-bold text-foreground mb-3">
            Community Venturrs
          </h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Soon you'll be able to discover travel inspiration from the Venturr community. 
            Browse curated collections, save ideas, and find your next adventure.
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-muted/50">
              <Users className="w-6 h-6 mx-auto mb-2 text-gunmetal-500" />
              <p className="text-xs font-medium text-gunmetal-700">Community</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50">
              <Heart className="w-6 h-6 mx-auto mb-2 text-gunmetal-500" />
              <p className="text-xs font-medium text-gunmetal-700">Save Ideas</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50">
              <MapPin className="w-6 h-6 mx-auto mb-2 text-gunmetal-500" />
              <p className="text-xs font-medium text-gunmetal-700">Explore</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Coming Soon
          </div>
        </div>
      </main>

      <TabBar />
    </div>
  );
}
