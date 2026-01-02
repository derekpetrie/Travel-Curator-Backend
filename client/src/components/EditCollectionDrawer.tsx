import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, Loader2, ImagePlus } from 'lucide-react';
import { CoverCustomizer } from './CoverCustomizer';
import type { Collection } from '@shared/schema';

interface EditCollectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection;
  currentCoverImage: string | null;
  currentCoverGradient: string;
  onSaveTitle: (title: string) => Promise<void>;
  onSaveCover: (coverImage: string | null, coverGradient: string | null) => Promise<void>;
  isSaving?: boolean;
}

export function EditCollectionDrawer({
  open,
  onOpenChange,
  collection,
  currentCoverImage,
  currentCoverGradient,
  onSaveTitle,
  onSaveCover,
  isSaving = false,
}: EditCollectionDrawerProps) {
  const [title, setTitle] = useState(collection.title);
  const [showCoverCustomizer, setShowCoverCustomizer] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(collection.title);
    }
  }, [open, collection.title]);

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      if (title.trim() !== collection.title) {
        await onSaveTitle(title.trim());
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCoverSave = async (coverImage: string | null, coverGradient: string | null) => {
    await onSaveCover(coverImage, coverGradient);
    setShowCoverCustomizer(false);
  };

  return (
    <>
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl outline-none">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-4" />
            
            <div className="px-6 pb-8 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <Drawer.Title className="font-heading text-xl font-bold">
                  Edit Collection
                </Drawer.Title>
                <button
                  onClick={() => onOpenChange(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                  data-testid="button-close-edit-drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter collection name"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                    data-testid="input-edit-title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Cover
                  </label>
                  <button
                    onClick={() => setShowCoverCustomizer(true)}
                    className="w-full h-32 rounded-xl overflow-hidden relative group border border-border"
                    data-testid="button-change-cover"
                  >
                    {currentCoverImage ? (
                      <img 
                        src={currentCoverImage} 
                        alt="Cover" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full"
                        style={{ 
                          background: `linear-gradient(135deg, ${currentCoverGradient.split(',')[0]?.trim() || '#FF385C'} 0%, ${currentCoverGradient.split(',')[1]?.trim() || '#FF6B8A'} 100%)` 
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <div className="flex items-center gap-2 text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <ImagePlus className="w-5 h-5" />
                        Change Cover
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || isSaving || !title.trim()}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="button-save-collection"
                >
                  {(saving || isSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <CoverCustomizer
        isOpen={showCoverCustomizer}
        onClose={() => setShowCoverCustomizer(false)}
        onSave={handleCoverSave}
        currentCoverImage={currentCoverImage}
        currentCoverGradient={currentCoverGradient}
      />
    </>
  );
}
