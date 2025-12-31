import { TabBar } from '@/components/TabBar';
import { Search as SearchIcon, MapPin, ArrowRight, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { MOCK_COLLECTIONS } from '@/lib/mockData';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

export default function Search() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'places' | 'collections'>('all');

  // Simple mock filtering
  const filteredCollections = MOCK_COLLECTIONS.filter(c => 
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  const trendingSearches = [
    'Tokyo Ramen', 'Kyoto Temples', 'Paris Bakeries', 'Amalfi Coast', 'NYC Rooftops'
  ];

  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-6 pb-2 border-b border-transparent">
        <h1 className="font-heading text-3xl font-extrabold text-foreground mb-4">Search</h1>
        
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3.5 top-3.5 w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search places, collections..." 
            className="w-full h-12 pl-11 pr-4 rounded-lg bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none font-medium text-foreground placeholder:text-muted-foreground/70"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {['all', 'places', 'collections'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as any)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all",
                activeFilter === filter 
                  ? "bg-foreground text-background" 
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {!query ? (
          /* Empty State / Trending */
          <div>
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Trending Now</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingSearches.map(term => (
                <button 
                  key={term}
                  onClick={() => setQuery(term)}
                  className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:border-primary/50 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Search Results */
          <div className="space-y-6">
            {/* Collections Result Section */}
            {(activeFilter === 'all' || activeFilter === 'collections') && (
               <div>
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Collections</h3>
                  {filteredCollections.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {filteredCollections.map(collection => (
                         <Link key={collection.id} href={`/collection/${collection.id}`}>
                           <a className="group block bg-card rounded-lg overflow-hidden border border-border shadow-sm hover:shadow-md transition-all">
                             <div className="aspect-square relative">
                               <img src={collection.thumbnail} className="w-full h-full object-cover" alt="" />
                               <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                             </div>
                             <div className="p-3">
                               <p className="font-bold text-sm truncate">{collection.title}</p>
                               <p className="text-xs text-muted-foreground">{collection.itemCount} items</p>
                             </div>
                           </a>
                         </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No collections found.</p>
                  )}
               </div>
            )}

            {/* Mock Places Result Section */}
            {(activeFilter === 'all' || activeFilter === 'places') && (
               <div>
                  <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Places</h3>
                  {/* Just showing some mock hits for "Tokyo" if query matches, else generic */}
                  {query.toLowerCase().includes('tokyo') || query.toLowerCase().includes('ramen') ? (
                    <div className="space-y-3">
                       <div className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg">
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground">Ichiran Ramen</h4>
                            <p className="text-xs text-muted-foreground">Shinjuku, Tokyo</p>
                          </div>
                          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                       </div>
                       <div className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg">
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground">Omoide Yokocho</h4>
                            <p className="text-xs text-muted-foreground">Shinjuku, Tokyo</p>
                          </div>
                          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                       </div>
                    </div>
                  ) : (
                     <div className="text-center py-8 opacity-50">
                       <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                       <p className="text-sm">Search for "Tokyo" to see example places.</p>
                     </div>
                  )}
               </div>
            )}
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
