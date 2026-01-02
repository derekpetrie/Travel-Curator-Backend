import { useState } from 'react';
import { X, ImagePlus, Palette, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpload } from '@/hooks/use-upload';

interface CoverCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (coverImage: string | null, coverGradient: string | null) => Promise<void>;
  currentCoverImage?: string | null;
  currentCoverGradient?: string | null;
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
  { name: 'Emerald', from: '#047857', to: '#10B981' },
  { name: 'Slate', from: '#475569', to: '#64748B' },
];

export function CoverCustomizer({
  isOpen,
  onClose,
  onSave,
  currentCoverImage,
  currentCoverGradient,
}: CoverCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'gradient'>('gradient');
  const [selectedGradient, setSelectedGradient] = useState<string | null>(currentCoverGradient || null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { getUploadParameters, isUploading } = useUpload({
    onSuccess: (response) => {
      setUploadedImageUrl(response.uploadURL.split('?')[0]);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (uploadedImageUrl) {
        await onSave(uploadedImageUrl, null);
      } else if (selectedGradient) {
        await onSave(null, selectedGradient);
      }
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      
      <div className="relative z-[61] w-full max-w-lg bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-heading text-lg font-bold">Customize Cover</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            data-testid="button-close-cover-customizer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setActiveTab('gradient')}
              className={cn(
                "flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all",
                activeTab === 'gradient'
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              data-testid="tab-gradient"
            >
              <Palette className="w-4 h-4" />
              Gradient
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={cn(
                "flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all",
                activeTab === 'upload'
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              data-testid="tab-upload"
            >
              <ImagePlus className="w-4 h-4" />
              Upload Photo
            </button>
          </div>

          {activeTab === 'gradient' && (
            <div className="grid grid-cols-5 gap-3">
              {PRESET_GRADIENTS.map((gradient) => {
                const gradientValue = `${gradient.from}, ${gradient.to}`;
                const isSelected = selectedGradient === gradientValue;
                return (
                  <button
                    key={gradient.name}
                    onClick={() => {
                      setSelectedGradient(gradientValue);
                      setUploadedImageUrl(null);
                    }}
                    className={cn(
                      "aspect-square rounded-xl transition-all relative",
                      isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:scale-105"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
                    }}
                    data-testid={`button-gradient-${gradient.name.toLowerCase()}`}
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
                    data-testid="button-remove-uploaded-image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className="aspect-video rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      <>
                        <ImagePlus className="w-10 h-10 text-gray-400" />
                        <span className="text-sm text-gray-500 font-medium">
                          Click to upload an image
                        </span>
                        <span className="text-xs text-gray-400">
                          JPG, PNG up to 10MB
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-cover-image"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving || (!selectedGradient && !uploadedImageUrl)}
            className={cn(
              "w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2",
              isSaving || (!selectedGradient && !uploadedImageUrl)
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-primary hover:bg-primary/90"
            )}
            data-testid="button-save-cover"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Cover'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
