import { TabBar } from '@/components/TabBar';
import { Settings, LogOut, MapPin, Heart } from 'lucide-react';

export default function Profile() {
  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      <div className="px-6 py-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-muted rounded-full mb-4 overflow-hidden border-4 border-card shadow-xl">
             <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80" alt="Profile" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Sarah Traveller</h1>
          <p className="text-muted-foreground text-sm">@sarah_roams</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-card p-4 rounded-xl border border-border text-center shadow-sm">
            <div className="text-2xl font-bold text-primary mb-1">142</div>
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Places Saved</div>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border text-center shadow-sm">
            <div className="text-2xl font-bold text-primary mb-1">12</div>
            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Collections</div>
          </div>
        </div>

        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <span className="font-medium">Liked Posts</span>
          </button>
          
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
          
          <button className="w-full flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:bg-muted/50 transition-colors text-red-500">
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>
      
      <TabBar />
    </div>
  );
}
