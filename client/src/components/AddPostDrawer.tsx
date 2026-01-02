import { Drawer } from 'vaul';
import { PlusSquare, Link as LinkIcon, Check, Loader2, FolderPlus, Folder, AlertCircle, ImagePlus, Palette, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollections, addPost, createCollection, updateCollectionCover, type AddPostResult } from '@/lib/api';
import { toast } from 'sonner';

type TabType = 'existing' | 'new';
type CoverType = 'upload' | 'gradient';

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

export function AddPostDrawer({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('new');
  const [isSuccess, setIsSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualCaption, setManualCaption] = useState('');
  const [needsManualCaption, setNeedsManualCaption] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [coverType, setCoverType] = useState<CoverType>('gradient');
  const [selectedGradient, setSelectedGradient] = useState<string>(`${PRESET_GRADIENTS[0].from}, ${PRESET_GRADIENTS[0].to}`);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    enabled: open,
  });

  if (collections.length > 0 && selectedCollection === null) {
    setSelectedCollection(collections[0].id);
  }

  const handleMutationError = (error: Error & { needsManualCaption?: boolean }) => {
    if (error.needsManualCaption) {
      setNeedsManualCaption(true);
      setErrorMessage('Could not fetch post details automatically. Please describe the travel locations mentioned in this post.');
    } else {
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    }
  };

  const addToExistingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCollection) throw new Error('No collection selected');
      return addPost(selectedCollection, url, needsManualCaption ? manualCaption : undefined);
    },
    onSuccess: (result: AddPostResult) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
      showSuccessAndClose();
      
      // Show warning toast if no places were extracted
      if (result.extractionWarning) {
        setTimeout(() => {
          toast.info(result.extractionWarning, { duration: 6000 });
        }, 2100);
      }
    },
    onError: handleMutationError,
  });

  const createNewMutation = useMutation({
    mutationFn: async () => {
      const collection = await createCollection(newCollectionName);
      
      // Set the cover based on user selection
      if (coverType === 'gradient') {
        await updateCollectionCover(collection.id, null, selectedGradient);
      } else if (coverType === 'upload' && uploadedImageUrl) {
        await updateCollectionCover(collection.id, uploadedImageUrl, null);
      }
      
      const postResult = await addPost(collection.id, url, needsManualCaption ? manualCaption : undefined);
      return { collection, postResult };
    },
    onSuccess: ({ postResult }) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
      showSuccessAndClose();
      
      // Show warning toast if no places were extracted
      if (postResult.extractionWarning) {
        setTimeout(() => {
          toast.info(postResult.extractionWarning, { duration: 6000 });
        }, 2100);
      }
    },
    onError: handleMutationError,
  });

  const showSuccessAndClose = () => {
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setUrl('');
      setNewCollectionName('');
      setManualCaption('');
      setNeedsManualCaption(false);
      setErrorMessage('');
      setActiveTab('new');
      setOpen(false);
    }, 2000);
  };

  const resetForm = () => {
    setUrl('');
    setNewCollectionName('');
    setManualCaption('');
    setNeedsManualCaption(false);
    setErrorMessage('');
    setActiveTab('new');
    setCoverType('gradient');
    setSelectedGradient(`${PRESET_GRADIENTS[0].from}, ${PRESET_GRADIENTS[0].to}`);
    setUploadedImageUrl(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!canSubmit) return;
    if (activeTab === 'existing') {
      addToExistingMutation.mutate();
    } else {
      createNewMutation.mutate();
    }
  };

  const isSubmitting = addToExistingMutation.isPending || createNewMutation.isPending;
  const hasRequiredCaption = !needsManualCaption || manualCaption.trim().length > 0;
  const canSubmitExisting = url.trim() && selectedCollection && hasRequiredCaption;
  const canSubmitNew = url.trim() && newCollectionName.trim() && hasRequiredCaption;
  const canSubmit = activeTab === 'existing' ? canSubmitExisting : canSubmitNew;

  return (
    <Drawer.Root shouldScaleBackground open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <Drawer.Trigger asChild>
        {children}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Drawer.Content className="bg-card flex flex-col rounded-t-[10px] max-h-[85vh] fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-border">
          <div className="p-4 bg-card rounded-t-[10px] flex-1 overflow-y-auto no-scrollbar">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-6" />
            
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <PlusSquare className="w-8 h-8" />
                </div>
                <h2 className="font-heading text-2xl font-bold mb-2">Save to Venturr</h2>
                <p className="text-muted-foreground">Paste a TikTok or Instagram link to automatically extract travel spots.</p>
              </div>

              {isSuccess ? (
                <div className="animate-in fade-in zoom-in duration-300 py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 shadow-lg shadow-green-500/30">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">Saved!</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'new' ? 'Venturr created and post added.' : 'Location extracted and added to Venturr.'}
                  </p>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium ml-1">Post URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground" />
                      <input 
                        type="url" 
                        placeholder="https://www.tiktok.com/@..." 
                        className="w-full h-12 pl-10 pr-4 rounded-lg bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                        data-testid="input-post-url"
                      />
                    </div>
                  </div>

                  <div className="flex rounded-lg bg-muted p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('new')}
                      data-testid="tab-new"
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                        activeTab === 'new' 
                          ? "bg-background text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <FolderPlus className="w-4 h-4" />
                      Create New
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('existing')}
                      data-testid="tab-existing"
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all",
                        activeTab === 'existing' 
                          ? "bg-background text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Folder className="w-4 h-4" />
                      Add to Existing
                    </button>
                  </div>

                  {activeTab === 'existing' ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium ml-1">Select Venturr</label>
                      <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto">
                        {collections.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">
                            No venturrs yet. Create one first!
                          </p>
                        ) : (
                          collections.map((collection: any) => (
                            <div 
                              key={collection.id}
                              onClick={() => setSelectedCollection(collection.id)}
                              data-testid={`venturr-option-${collection.id}`}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                selectedCollection === collection.id 
                                  ? "border-primary bg-primary/5 shadow-sm" 
                                  : "border-border bg-card hover:bg-muted/50"
                              )}
                            >
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {collection.title[0]}
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-sm">{collection.title}</p>
                              </div>
                              <div className={cn(
                                "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                selectedCollection === collection.id ? "bg-primary border-primary" : "border-muted-foreground/30"
                              )}>
                                {selectedCollection === collection.id && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium ml-1">Venturr Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g., Japan 2025, Bali Trip, Hidden Gems..." 
                          className="w-full h-12 px-4 rounded-lg bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none"
                          value={newCollectionName}
                          onChange={(e) => setNewCollectionName(e.target.value)}
                          required
                          data-testid="input-venturr-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium ml-1">Cover Style</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCoverType('upload')}
                            data-testid="cover-type-upload"
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all border",
                              coverType === 'upload'
                                ? "bg-primary text-white border-primary"
                                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                            )}
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={() => setCoverType('gradient')}
                            data-testid="cover-type-gradient"
                            className={cn(
                              "flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all border",
                              coverType === 'gradient'
                                ? "bg-primary text-white border-primary"
                                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                            )}
                          >
                            <Palette className="w-3.5 h-3.5" />
                            Gradient
                          </button>
                        </div>
                      </div>

                      {coverType === 'upload' && (
                        <div className="space-y-2">
                          {uploadedImageUrl ? (
                            <div className="relative h-24 rounded-lg overflow-hidden">
                              <img
                                src={uploadedImageUrl}
                                alt="Cover preview"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setUploadedImageUrl(null)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70"
                                data-testid="button-remove-cover"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <label className="block cursor-pointer">
                              <div className="h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors">
                                {isUploading ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                ) : (
                                  <>
                                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Click to upload</span>
                                  </>
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                                data-testid="input-cover-upload"
                              />
                            </label>
                          )}
                        </div>
                      )}

                      {coverType === 'gradient' && (
                        <div className="grid grid-cols-8 gap-2">
                          {PRESET_GRADIENTS.map((gradient) => {
                            const gradientValue = `${gradient.from}, ${gradient.to}`;
                            const isSelected = selectedGradient === gradientValue;
                            return (
                              <button
                                key={gradient.name}
                                type="button"
                                onClick={() => setSelectedGradient(gradientValue)}
                                className={cn(
                                  "aspect-square rounded-lg transition-all",
                                  isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                                )}
                                style={{
                                  background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
                                }}
                                data-testid={`gradient-${gradient.name.toLowerCase()}`}
                              >
                                {isSelected && (
                                  <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-lg">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {errorMessage && !needsManualCaption && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-sm text-destructive">{errorMessage}</p>
                    </div>
                  )}

                  {needsManualCaption && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-700">{errorMessage}</p>
                      </div>
                      <label className="text-sm font-medium ml-1">Describe the locations</label>
                      <textarea 
                        placeholder="e.g., This video shows a cafe called Blue Bottle Coffee in Shibuya, Tokyo..."
                        className="w-full min-h-[100px] p-4 rounded-lg bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none resize-none"
                        value={manualCaption}
                        onChange={(e) => setManualCaption(e.target.value)}
                        data-testid="input-manual-caption"
                      />
                      <p className="text-xs text-muted-foreground ml-1">
                        Include place names, cities, or addresses mentioned in the post.
                      </p>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isSubmitting || !canSubmit}
                    data-testid="button-save-post"
                    className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-lg shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {needsManualCaption ? 'Saving...' : (activeTab === 'new' ? 'Creating & Extracting...' : 'Extracting Places...')}
                      </>
                    ) : (
                      needsManualCaption ? 'Save with Description' : (activeTab === 'new' ? 'Create Venturr & Save' : 'Save to Venturr')
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
