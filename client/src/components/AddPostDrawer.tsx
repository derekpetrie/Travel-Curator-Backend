import { Drawer } from 'vaul';
import { PlusSquare, Link as LinkIcon, Check, Loader2, FolderPlus, Folder, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCollections, addPost, createCollection } from '@/lib/api';

type TabType = 'existing' | 'new';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
      showSuccessAndClose();
    },
    onError: handleMutationError,
  });

  const createNewMutation = useMutation({
    mutationFn: async () => {
      const collection = await createCollection(newCollectionName);
      await addPost(collection.id, url, needsManualCaption ? manualCaption : undefined);
      return collection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
      showSuccessAndClose();
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
        <Drawer.Content className="bg-card flex flex-col rounded-t-[10px] h-[85vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-border">
          <div className="p-4 bg-card rounded-t-[10px] flex-1 overflow-y-auto no-scrollbar">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mb-6" />
            
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                  <PlusSquare className="w-8 h-8" />
                </div>
                <h2 className="font-heading text-2xl font-bold mb-2">Save to Collection</h2>
                <p className="text-muted-foreground">Paste a TikTok or Instagram link to automatically extract travel spots.</p>
              </div>

              {isSuccess ? (
                <div className="animate-in fade-in zoom-in duration-300 py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 shadow-lg shadow-green-500/30">
                    <Check className="w-10 h-10" />
                  </div>
                  <h3 className="font-heading text-xl font-bold text-foreground">Saved!</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'new' ? 'Collection created and post added.' : 'Location extracted and added to collection.'}
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
                      <label className="text-sm font-medium ml-1">Select Collection</label>
                      <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto">
                        {collections.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">
                            No collections yet. Create one first!
                          </p>
                        ) : (
                          collections.map((collection: any) => (
                            <div 
                              key={collection.id}
                              onClick={() => setSelectedCollection(collection.id)}
                              data-testid={`collection-option-${collection.id}`}
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
                    <div className="space-y-2">
                      <label className="text-sm font-medium ml-1">Collection Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g., Japan 2025, Bali Trip, Hidden Gems..." 
                        className="w-full h-12 px-4 rounded-lg bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        required
                        data-testid="input-collection-name"
                      />
                      <p className="text-xs text-muted-foreground ml-1">
                        A travel-related name will generate a beautiful thumbnail automatically!
                      </p>
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
                      needsManualCaption ? 'Save with Description' : (activeTab === 'new' ? 'Create Collection & Save' : 'Save to Collection')
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
