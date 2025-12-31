import { MapPin } from 'lucide-react';

export function MapPlaceholder() {
  return (
    <div className="w-full h-full min-h-[400px] bg-muted relative overflow-hidden rounded-xl border border-border">
      {/* Pattern background */}
      <div className="absolute inset-0 opacity-10" 
        style={{
          backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />
      
      {/* Fake map UI */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/20 rounded-full animate-ping" />
          <div className="relative z-10 w-10 h-10 bg-primary rounded-full shadow-xl flex items-center justify-center text-white border-4 border-white">
            <MapPin className="w-5 h-5" />
          </div>
          
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-20">
            <span className="text-xs font-bold">You are here</span>
          </div>
        </div>

        {/* Scattered pins */}
        <div className="absolute top-1/4 left-1/4">
          <div className="w-3 h-3 bg-secondary-foreground rounded-full shadow-md" />
        </div>
        <div className="absolute bottom-1/3 right-1/4">
           <div className="w-3 h-3 bg-secondary-foreground rounded-full shadow-md" />
        </div>
      </div>
    </div>
  );
}
