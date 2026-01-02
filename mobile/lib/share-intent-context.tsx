import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import { collectionsApi, Collection } from './api';

interface ShareIntentContextType {
  sharedUrl: string | null;
  isProcessing: boolean;
  collections: Collection[];
  clearSharedUrl: () => void;
  addToCollection: (collectionId: number) => Promise<boolean>;
  refreshCollections: () => Promise<void>;
}

const ShareIntentContext = createContext<ShareIntentContextType | null>(null);

function extractUrl(shareIntent: ShareIntent | null): string | null {
  if (!shareIntent) return null;
  
  if (shareIntent.webUrl) {
    return shareIntent.webUrl;
  }
  
  if (shareIntent.text) {
    const urlMatch = shareIntent.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return urlMatch[0];
    }
  }
  
  return null;
}

function isValidSocialUrl(url: string): boolean {
  const patterns = [
    /tiktok\.com/i,
    /instagram\.com/i,
    /vm\.tiktok\.com/i,
  ];
  return patterns.some(pattern => pattern.test(url));
}

export function ShareIntentProvider({ children }: { children: ReactNode }) {
  const { shareIntent, resetShareIntent } = useShareIntent();
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  const refreshCollections = useCallback(async () => {
    try {
      const data = await collectionsApi.getAll();
      setCollections(data);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  }, []);

  useEffect(() => {
    const url = extractUrl(shareIntent);
    if (url && isValidSocialUrl(url)) {
      setSharedUrl(url);
      refreshCollections();
    }
  }, [shareIntent, refreshCollections]);

  const clearSharedUrl = useCallback(() => {
    setSharedUrl(null);
    resetShareIntent();
  }, [resetShareIntent]);

  const addToCollection = useCallback(async (collectionId: number): Promise<boolean> => {
    if (!sharedUrl) return false;
    
    setIsProcessing(true);
    try {
      await collectionsApi.addPost(collectionId, sharedUrl);
      clearSharedUrl();
      return true;
    } catch (error) {
      console.error('Failed to add post:', error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [sharedUrl, clearSharedUrl]);

  return (
    <ShareIntentContext.Provider value={{
      sharedUrl,
      isProcessing,
      collections,
      clearSharedUrl,
      addToCollection,
      refreshCollections,
    }}>
      {children}
    </ShareIntentContext.Provider>
  );
}

export function useShareIntentContext() {
  const context = useContext(ShareIntentContext);
  if (!context) {
    throw new Error('useShareIntentContext must be used within a ShareIntentProvider');
  }
  return context;
}
