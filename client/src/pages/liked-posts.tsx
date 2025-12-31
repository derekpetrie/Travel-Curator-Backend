import { useLocation, Link } from 'wouter';
import { PostCard } from '@/components/PostCard';
import { MOCK_COLLECTIONS } from '@/lib/mockData';
import { ChevronLeft, Heart } from 'lucide-react';
import { TabBar } from '@/components/TabBar';

export default function LikedPosts() {
  const [, setLocation] = useLocation();

  // Aggregate all posts from collections to simulate a "Liked" feed for the mockup
  const allLikedPosts = MOCK_COLLECTIONS.flatMap(c => c.posts);

  return (
    <div className="min-h-screen pb-24 bg-background safe-top">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-6 pt-6 pb-4 border-b border-transparent">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/profile">
            <a className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </a>
          </Link>
          <h1 className="font-heading text-2xl font-bold">Liked Posts</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {allLikedPosts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {allLikedPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
            {/* Duplicate for demo density */}
            {allLikedPosts.map(post => (
              <PostCard key={`${post.id}-duplicate`} post={{...post, id: `${post.id}-duplicate`}} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-bold text-lg text-foreground mb-1">No likes yet</h3>
            <p className="text-sm">Posts you like will appear here.</p>
          </div>
        )}
      </div>

      <TabBar />
    </div>
  );
}
