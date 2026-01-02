import { Play, Instagram, MapPin, ExternalLink } from 'lucide-react';
import type { Post } from '@shared/schema';

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <div className="flex gap-4 p-3 rounded-lg bg-card border border-border/50 hover:border-primary/20 transition-colors shadow-sm">
      <div className="relative w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {post.thumbnailUrl ? (
          <img 
            src={post.thumbnailUrl} 
            alt="Thumbnail" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <MapPin className="w-8 h-8 text-primary/40" />
          </div>
        )}
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
            {post.caption || 'No caption available'}
          </p>
          <p className="text-xs text-muted-foreground font-medium">
            {post.author || 'Unknown author'}
          </p>
        </div>
        
        <a 
          href={post.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="self-start text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
          data-testid="link-view-original"
        >
          {post.source === 'tiktok' ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
              </svg>
              View on TikTok
            </>
          ) : post.source === 'instagram' ? (
            <>
              <Instagram className="w-3.5 h-3.5" />
              View on Instagram
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5" />
              View Original
            </>
          )}
        </a>
      </div>
    </div>
  );
}
