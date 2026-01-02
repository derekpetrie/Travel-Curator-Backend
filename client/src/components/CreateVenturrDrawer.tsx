import { useState } from 'react';
import { Drawer } from 'vaul';
import { X, Loader2, ImagePlus, Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateVenturrDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, coverImage: string | null, coverGradient: string | null) => Promise<void>;
  isCreating?: boolean;
}

const PRESET_GRADIENTS = [
  { name: 'Coral', from: '#FF385C', to: '#FF6B8A' },
  { name: 'Ocean', from: '#0EA5E9', to: '#38BDF8' },
  { name: 'Forest', from: '#10B981', to: '#34D399' },
  { name: 'Sunset', from: '#F97316', to: '#FB923C' },
  { name: 'Lavender', from: '#8B5CF6', to: '#A78BFA' },
  { name: 'Rose', from: '#EC4899', to: '#F472B6' },
  { name: 'Midnight', from: '#1E3A8A', to: '#3B82F6' },
  { name: 'Amber', from: '#D97706', to: '#FBBF24' },
];

export function CreateVenturrDrawer({
  open,
  onOpenChange,
  onCreate,
  isCreating = false,
}: CreateVenturrDrawerProps) {
  const [title, setTitle] = useState('');
  const [activeTab, setActiveTab] = useState<'none' | 'upload' | 'gradient'>('none');
  const [selectedGradient, setSelectedGradient] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setActiveTab('none');
    setSelectedGradient(null);
    setUploadedImageUrl(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'image/jpeg',
        }),
      });

      if (!response.ok) throw new Error('Failed to get upload URL');

      const { uploadURL } = await response.json();

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      });

      setUploadedImageUrl(uploadURL.split('?')[0]);
      setSelectedGradient(null);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    await onCreate(title.trim(), uploadedImageUrl, selectedGradient);
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
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Cover (Optional)
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  You can add a cover now or let it use the first post's thumbnail later.
                </p>
                
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveTab(activeTab === 'upload' ? 'none' : 'upload')}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all",
                      activeTab === 'upload'
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    data-testid="tab-create-upload"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Upload Photo
                  </button>
                  <button
                    onClick={() => setActiveTab(activeTab === 'gradient' ? 'none' : 'gradient')}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all",
                      activeTab === 'gradient'
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                    data-testid="tab-create-gradient"
                  >
                    <Palette className="w-4 h-4" />
                    Gradient
                  </button>
                </div>

                {activeTab === 'upload' && (
                  <div className="space-y-4">
                    {uploadedImageUrl ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden">
                        <img
                          src={uploadedImageUrl}
                          alt="Uploaded cover"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setUploadedImageUrl(null)}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                          data-testid="button-remove-create-image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="block cursor-pointer">
                        <div className="aspect-video rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors">
                          {isUploading ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          ) : (
                            <>
                              <ImagePlus className="w-10 h-10 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground font-medium">
                                Click to upload
                              </span>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          data-testid="input-create-cover-image"
                        />
                      </label>
                    )}
                  </div>
                )}

                {activeTab === 'gradient' && (
                  <div className="grid grid-cols-4 gap-3">
                    {PRESET_GRADIENTS.map((gradient) => {
                      const gradientValue = `${gradient.from}, ${gradient.to}`;
                      const isSelected = selectedGradient === gradientValue;
                      return (
                        <button
                          key={gradient.name}
                          onClick={() => {
                            setSelectedGradient(isSelected ? null : gradientValue);
                            setUploadedImageUrl(null);
                          }}
                          className={cn(
                            "aspect-square rounded-xl transition-all relative",
                            isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:scale-105"
                          )}
                          style={{
                            background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
                          }}
                          data-testid={`button-create-gradient-${gradient.name.toLowerCase()}`}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
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
