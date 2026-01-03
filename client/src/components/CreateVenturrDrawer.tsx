import { useState } from 'react';
import { Drawer } from 'vaul';
import { X, Loader2 } from 'lucide-react';

interface CreateVenturrDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, coverImage: string | null, coverGradient: string | null) => Promise<void>;
  isCreating?: boolean;
}

const VENTURR_GRADIENTS = [
  { from: '#F25F5C', to: '#FF8A87' },
  { from: '#3A4753', to: '#6B7280' },
  { from: '#4C82F7', to: '#7BA3FA' },
  { from: '#4CAF93', to: '#7BCDB8' },
  { from: '#F4B740', to: '#F8D070' },
  { from: '#8B5CF6', to: '#A78BFA' },
  { from: '#EC4899', to: '#F472B6' },
  { from: '#0EA5E9', to: '#38BDF8' },
];

function getRandomGradient(): string {
  const gradient = VENTURR_GRADIENTS[Math.floor(Math.random() * VENTURR_GRADIENTS.length)];
  return `${gradient.from}, ${gradient.to}`;
}

export function CreateVenturrDrawer({
  open,
  onOpenChange,
  onCreate,
  isCreating = false,
}: CreateVenturrDrawerProps) {
  const [title, setTitle] = useState('');

  const resetForm = () => {
    setTitle('');
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    const randomGradient = getRandomGradient();
    await onCreate(title.trim(), null, randomGradient);
    resetForm();
    onOpenChange(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl outline-none">
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-4" />
          
          <div className="px-6 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <Drawer.Title className="font-heading text-xl font-bold">
                Create Venturr
              </Drawer.Title>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-full hover:bg-muted transition-colors"
                data-testid="button-close-create-drawer"
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
                  placeholder="e.g., Japan Trip 2025"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                  data-testid="input-create-title"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2">
                  The cover will automatically use thumbnails from your saved posts.
                </p>
              </div>

              <button
                onClick={handleCreate}
                disabled={isCreating || !title.trim()}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                data-testid="button-create-venturr"
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Venturr
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
