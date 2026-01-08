import { Link, useLocation } from 'wouter';
import { Home, Compass, PlusSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabBarProps {
  onAddClick: () => void;
}

export function TabBar({ onAddClick }: TabBarProps) {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 glass-tab pb-safe-bottom pt-2 px-6">
      <div className="flex justify-between items-center max-w-md mx-auto h-16">
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            location === '/' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Home className="w-6 h-6" strokeWidth={location === '/' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <Link
          href="/search"
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            location === '/search' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Compass className="w-6 h-6" strokeWidth={location === '/search' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Explore</span>
        </Link>

        {/* ✅ Controlled Add button */}
        <button
          onClick={onAddClick}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 text-white">
            <PlusSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium">Add</span>
        </button>

        <Link
          href="/profile"
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            location === '/profile' ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="w-6 h-6" strokeWidth={location === '/profile' ? 2.5 : 2} />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </div>
  );
}
