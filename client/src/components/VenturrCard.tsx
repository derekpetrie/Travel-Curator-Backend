import type { Collection } from '@shared/schema';
import type { MouseEvent } from 'react';
import { Link } from 'wouter';
import { ArrowRight, MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { renameCollection, deleteCollection } from '@/lib/api';

interface VenturrCardProps {
  venturr: Collection & { itemCount?: number; firstPostThumbnail?: string | null };
}

function parseGradient(gradient: string | null | undefined): { from: string; to: string } {
  if (!gradient) return { from: '#FF385C', to: '#FF6B8A' };
  const parts = gradient.split(',').map(s => {
    const color = s.trim();
    return color.startsWith('#') ? color : `#${color}`;
  });
  return { from: parts[0] || '#FF385C', to: parts[1] || '#FF6B8A' };
}

export function VenturrCard({ venturr }: VenturrCardProps) {
  const gradient = parseGradient(venturr.coverGradient);
  const [showMenu, setShowMenu] = useState(false);
  const queryClient = useQueryClient();
  
  // Cover: use first post's thumbnail, otherwise show gradient
  const displayImage = venturr.firstPostThumbnail || null;

  const renameMutation = useMutation({
    mutationFn: async () => {
      const newTitle = prompt('Enter new name:', venturr.title);
      if (!newTitle || newTitle.trim() === venturr.title) return null;
      return renameCollection(venturr.id, newTitle.trim());
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.invalidateQueries({ queryKey: ['collections'] });
      }
      setShowMenu(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!confirm('Delete this Venturr?')) return null;
      return deleteCollection(venturr.id);
    },
    onSuccess: (result) => {
      if (result !== null) {
        queryClient.invalidateQueries({ queryKey: ['collections'] });
      }
      setShowMenu(false);
    },
  });

  const handleMenuClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(!showMenu);
  };
  
  return (
    <div className="relative">
      {/* Mobile: Horizontal bar layout */}
      <div className="md:hidden flex items-stretch h-[88px] rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition-all overflow-hidden">
        {/* Thumbnail - full bleed to border */}
        <div className="w-[88px] flex-shrink-0">
          {displayImage ? (
            <img 
              src={displayImage} 
              alt={venturr.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
            >
              <MapPin className="w-6 h-6 text-white/80" />
            </div>
          )}
        </div>
        
        <Link 
          href={`/venturr/${venturr.id}`} 
          className="flex items-center gap-3 flex-1 min-w-0 px-3"
        >
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-base font-bold text-foreground line-clamp-1">
              {venturr.title}
            </h3>
            <span className="text-muted-foreground text-sm">
              {venturr.itemCount ?? 0} items
            </span>
          </div>
          
          {/* Arrow indicator */}
          <ArrowRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
        </Link>
        
        {/* Mobile menu button */}
        <button
          onClick={handleMenuClick}
          data-testid={`button-menu-venturr-mobile-${venturr.id}`}
          className="w-12 flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop: Original card layout */}
      <Link 
        href={`/venturr/${venturr.id}`} 
        className="group hidden md:block relative overflow-hidden rounded-xl aspect-[4/5] bg-muted shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
      >
        {displayImage ? (
          <img 
            src={displayImage} 
            alt={venturr.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)` }}
          >
            <MapPin className="w-12 h-12 text-white/80" />
          </div>
        )}
        {/* Labels with opaque background */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2">
            <h3 className="font-heading text-base font-bold text-white line-clamp-2 leading-tight">
              {venturr.title}
            </h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-white/80 text-xs font-medium">
                {venturr.itemCount ?? 0} items
              </span>
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        </div>
      </Link>

      {/* Menu button - hidden on mobile, shown on desktop */}
      <button
        onClick={handleMenuClick}
        data-testid={`button-menu-venturr-${venturr.id}`}
        className="hidden md:flex absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm items-center justify-center text-white hover:bg-black/60 transition-colors z-10"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-20" 
            onClick={() => setShowMenu(false)} 
          />
          <div className="absolute top-12 right-2 bg-white rounded-lg shadow-lg py-1 z-30 min-w-[140px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                renameMutation.mutate();
              }}
              data-testid={`button-rename-venturr-${venturr.id}`}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100"
            >
              <Pencil className="w-4 h-4" />
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate();
              }}
              data-testid={`button-delete-venturr-${venturr.id}`}
              className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-100 text-red-600"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
