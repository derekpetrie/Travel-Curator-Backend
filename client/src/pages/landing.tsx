import { Sparkles, Globe, BookmarkCheck } from 'lucide-react';
import venturrrLogo from '../assets/venturr-logo.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full overflow-hidden mb-6 shadow-lg">
          <img 
            src={venturrrLogo} 
            alt="Venturr" 
            className="w-full h-full object-cover"
          />
        </div>
        
        <h1 className="font-heading text-4xl font-extrabold mb-3 tracking-tight">
          Venturr
        </h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-sm">
          Save travel spots from TikTok & Instagram. Organize trips. Explore the world.
        </p>

        <a
          href="/api/login"
          data-testid="button-login"
          className="w-full max-w-xs h-14 bg-primary text-primary-foreground font-bold rounded-lg shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Get Started
        </a>

        <p className="text-sm text-muted-foreground mt-4">
          Sign in with Google, GitHub, or email
        </p>
      </div>

      <div className="px-8 py-12 bg-muted/30">
        <h2 className="font-heading text-xl font-bold text-center mb-8">How it works</h2>
        
        <div className="space-y-6 max-w-sm mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <BookmarkCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold mb-1">Save posts</h3>
              <p className="text-sm text-muted-foreground">Paste a TikTok or Instagram link to save it to a Venturr</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold mb-1">AI extracts places</h3>
              <p className="text-sm text-muted-foreground">We automatically find restaurants, hotels, and landmarks from the video</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold mb-1">See on a map</h3>
              <p className="text-sm text-muted-foreground">All your saved places appear on a beautiful map view</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
