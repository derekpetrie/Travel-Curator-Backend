import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus, MapPin, Link, X, ExternalLink } from 'lucide-react-native';
import { colors, spacing, radius } from '../../lib/colors';
import { collectionsApi, Collection, Post, Place } from '../../lib/api';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPostUrl, setNewPostUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'places'>('places');

  const collectionId = parseInt(id || '0');

  const loadData = useCallback(async () => {
    if (!collectionId) return;
    
    try {
      const [collectionData, postsData, placesData] = await Promise.all([
        collectionsApi.getOne(collectionId),
        collectionsApi.getPosts(collectionId),
        collectionsApi.getPlaces(collectionId),
      ]);
      setCollection(collectionData);
      setPosts(postsData);
      setPlaces(placesData);
    } catch (error) {
      console.error('Failed to load collection:', error);
      Alert.alert('Error', 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const addPost = async () => {
    if (!newPostUrl.trim()) return;
    
    const url = newPostUrl.trim();
    if (!url.includes('tiktok.com') && !url.includes('instagram.com')) {
      Alert.alert('Invalid URL', 'Please paste a TikTok or Instagram link');
      return;
    }
    
    setAdding(true);
    try {
      await collectionsApi.addPost(collectionId, url);
      setNewPostUrl('');
      setShowAddModal(false);
      await loadData();
      Alert.alert('Success', 'Post added! AI is extracting places from it.');
    } catch (error) {
      Alert.alert('Error', 'Failed to add post. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {collection?.name || 'Collection'}
        </Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'places' && styles.tabActive]}
          onPress={() => setActiveTab('places')}
        >
          <Text style={[styles.tabText, activeTab === 'places' && styles.tabTextActive]}>
            Places ({places.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
            Posts ({posts.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {activeTab === 'places' ? (
          places.length === 0 ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No places yet</Text>
              <Text style={styles.emptyText}>
                Add a TikTok or Instagram post and AI will extract the places mentioned
              </Text>
            </View>
          ) : (
            places.map((place) => (
              <View key={place.id} style={styles.placeCard}>
                <View style={styles.placeIcon}>
                  <MapPin size={22} color={colors.primary} />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  {place.address && (
                    <Text style={styles.placeAddress} numberOfLines={2}>
                      {place.address}
                    </Text>
                  )}
                  {place.latitude && place.longitude && (
                    <Text style={styles.placeCoords}>
                      {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )
        ) : posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Link size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button to add a TikTok or Instagram link
            </Text>
          </View>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postIcon}>
                <ExternalLink size={20} color={colors.primary} />
              </View>
              <View style={styles.postInfo}>
                <Text style={styles.postPlatform}>
                  {post.platform === 'tiktok' ? 'TikTok' : 'Instagram'}
                </Text>
                <Text style={styles.postUrl} numberOfLines={1}>
                  {post.url}
                </Text>
                {post.extractedPlaces && post.extractedPlaces.length > 0 && (
                  <Text style={styles.postPlaces}>
                    {post.extractedPlaces.length} places found
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Post</Text>
            <TouchableOpacity onPress={addPost} disabled={adding || !newPostUrl.trim()}>
              <Text style={[styles.saveButton, (!newPostUrl.trim() || adding) && styles.saveButtonDisabled]}>
                {adding ? 'Adding...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Paste TikTok or Instagram link</Text>
            <TextInput
              style={styles.input}
              placeholder="https://www.tiktok.com/..."
              placeholderTextColor={colors.textMuted}
              value={newPostUrl}
              onChangeText={setNewPostUrl}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.hint}>
              AI will analyze the video and extract all mentioned restaurants, hotels, attractions, and other places
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  placeAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  placeCoords: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  postIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  postInfo: {
    flex: 1,
  },
  postPlatform: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  postUrl: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  postPlaces: {
    fontSize: 13,
    color: colors.success,
    marginTop: 4,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  saveButtonDisabled: {
    color: colors.textMuted,
  },
  modalContent: {
    padding: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
