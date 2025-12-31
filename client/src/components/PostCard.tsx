import { Post } from '@/lib/mockData';
import { Play, Instagram } from 'lucide-react';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <div className="flex gap-4 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/20 transition-colors shadow-sm">
      <div className="relative w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        <img 
          src={post.thumbnailUrl} 
          alt="Thumbnail" 
          className="w-full h-full object-cover"
        />
        <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
           {post.source === 'tiktok' ? (
             <Play className="w-3 h-3 fill-white" />
           ) : (
             <Instagram className="w-3 h-3" />
           )}
        </div>
      </div>
      
      <div className="flex flex-col justify-between py-1 flex-1 min-w-0">
        <div>
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed mb-2">
            {post.caption}
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            {post.author}
          </p>
        </div>
        
        <button className="self-start text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
          View Original
        </button>
      </div>
    </div>
  );
}
