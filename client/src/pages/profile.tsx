import { TabBar } from '@/components/TabBar';
import { Settings, LogOut, MapPin, Bookmark, User } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { fetchCollections } from '@/lib/api';

export default function Profile() {
  const { user, logout } = useAuth();

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const displayName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email?.split('@')[0] || 'Traveler';

  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      <div className="px-6 py-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-muted rounded-full mb-4 overflow-hidden border-4 border-card shadow-xl flex items-center justify-center">
             {user?.profileImageUrl ? (
               <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
             ) : (
               <User className="w-12 h-12 text-muted-foreground" />
             )}
          </div>
          <h1 className="font-heading text-2xl font-bold" data-testid="text-display-name">{displayName}</h1>
          <p className="text-muted-foreground text-sm" data-testid="text-email">{user?.email || ''}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card p-4 rounded-xl border border-border text-center shadow-sm">
            <div className="text-2xl font-bold text-primary mb-1" data-testid="text-venturrs-count">{collections.length}</div>
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Venturrs</div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border text-center shadow-sm">
            <div className="text-2xl font-bold text-primary mb-1">0</div>
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Places Saved</div>
          </div>
        </div>

        <div className="space-y-2">
          <Link href="/saved">
            <a className="w-full flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Bookmark className="w-4 h-4 fill-current" />
              </div>
              <span className="font-medium">Saved Posts</span>
            </a>
          </Link>
          
          <button className="w-full flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="font-medium">Map Settings</span>
          </button>

          <button className="w-full flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <span className="font-medium">Preferences</span>
          </button>
          
          <a 
            href="/api/logout"
            data-testid="button-logout"
            className="w-full flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors text-red-500"
          >
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="font-medium">Log Out</span>
          </a>
        </div>
      </div>
      
      <TabBar />
    </div>
  );
}
