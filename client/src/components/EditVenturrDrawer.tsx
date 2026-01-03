import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { X, Loader2 } from 'lucide-react';
import type { Collection } from '@shared/schema';

interface EditVenturrDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venturr: Collection;
  onSaveTitle: (title: string) => Promise<void>;
  isSaving?: boolean;
}

export function EditVenturrDrawer({
  open,
  onOpenChange,
  venturr,
  onSaveTitle,
  isSaving = false,
}: EditVenturrDrawerProps) {
  const [title, setTitle] = useState(venturr.title);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(venturr.title);
    }
  }, [open, venturr.title]);

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      if (title.trim() !== venturr.title) {
        await onSaveTitle(title.trim());
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl outline-none">
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-4" />
          
          <div className="px-6 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <Drawer.Title className="font-heading text-xl font-bold">
                Edit Venturr
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
                  Venturr Name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter Venturr name"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                  data-testid="input-edit-title"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  The cover automatically uses thumbnails from your saved posts.
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || isSaving || !title.trim()}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="button-save-venturr"
              >
                {(saving || isSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
