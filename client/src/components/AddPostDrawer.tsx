import { Drawer } from 'vaul';
import { PlusSquare, Link as LinkIcon, Check } from 'lucide-react';
import { useState } from 'react';
import { MOCK_COLLECTIONS } from '@/lib/mockData';
import { cn } from '@/lib/utils';

export function AddPostDrawer({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState('');
  const [selectedCollection, setSelectedCollection] = useState(MOCK_COLLECTIONS[0].id);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    
    // Simulate backend processing
    setTimeout(() => {
      setIsSimulating(false);
      setIsSuccess(true);
      
      // Reset after showing success
      setTimeout(() => {
        setIsSuccess(false);
        setUrl('');
      }, 2000);
    }, 1500);
  };

  return (
    <Drawer.Root shouldScaleBackground>
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
                  <p className="text-muted-foreground">Location extracted and added to collection.</p>
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
                        className="w-full h-12 pl-10 pr-4 rounded-xl bg-muted border-transparent focus:bg-background focus:border-primary transition-all outline-none"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium ml-1">Select Collection</label>
                    <div className="grid grid-cols-1 gap-3">
                      {MOCK_COLLECTIONS.map(collection => (
                        <div 
                          key={collection.id}
                          onClick={() => setSelectedCollection(collection.id)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                            selectedCollection === collection.id 
                              ? "border-primary bg-primary/5 shadow-sm" 
                              : "border-border bg-card hover:bg-muted/50"
                          )}
                        >
                          <img src={collection.thumbnail} className="w-10 h-10 rounded-lg object-cover bg-muted" alt="" />
                          <div className="flex-1">
                            <p className="font-bold text-sm">{collection.title}</p>
                            <p className="text-xs text-muted-foreground">{collection.itemCount} items</p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                            selectedCollection === collection.id ? "bg-primary border-primary" : "border-muted-foreground/30"
                          )}>
                            {selectedCollection === collection.id && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    disabled={isSimulating}
                    className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2"
                  >
                    {isSimulating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Extracting Places...
                      </>
                    ) : (
                      'Save to Collection'
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
