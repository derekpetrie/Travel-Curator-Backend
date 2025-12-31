import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, MapPin, X, Trash2 } from 'lucide-react-native';
import { colors, spacing, radius } from '../../lib/colors';
import { collectionsApi, Collection } from '../../lib/api';

export default function CollectionsScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadCollections = useCallback(async () => {
    try {
      const data = await collectionsApi.getAll();
      setCollections(data);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections();
    setRefreshing(false);
  }, [loadCollections]);

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    setCreating(true);
    try {
      await collectionsApi.create({
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim() || undefined,
      });
      setNewCollectionName('');
      setNewCollectionDescription('');
      setShowCreateModal(false);
      await loadCollections();
    } catch (error) {
      Alert.alert('Error', 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const deleteCollection = async (id: number, name: string) => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${name}"? This will also delete all posts and places in this collection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionsApi.delete(id);
              await loadCollections();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete collection');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Saved Posts</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
            <Plus size={24} color={colors.background} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading collections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Posts</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateModal(true)}>
          <Plus size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {collections.length === 0 ? (
          <View style={styles.emptyState}>
            <MapPin size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No collections yet</Text>
            <Text style={styles.emptyText}>
              Create a collection to start saving travel posts from TikTok and Instagram
            </Text>
            <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
              <Plus size={20} color={colors.background} />
              <Text style={styles.createButtonText}>Create Collection</Text>
            </TouchableOpacity>
          </View>
        ) : (
          collections.map((collection) => (
            <TouchableOpacity
              key={collection.id}
              style={styles.collectionCard}
              onPress={() => router.push(`/collection/${collection.id}`)}
            >
              <View style={styles.collectionImage}>
                <MapPin size={28} color={colors.primary} />
              </View>
              <View style={styles.collectionInfo}>
                <Text style={styles.collectionName}>{collection.name}</Text>
                {collection.description && (
                  <Text style={styles.collectionDescription} numberOfLines={2}>
                    {collection.description}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteCollection(collection.id, collection.name)}
              >
                <Trash2 size={20} color={colors.error} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Collection</Text>
            <TouchableOpacity onPress={createCollection} disabled={creating || !newCollectionName.trim()}>
              <Text style={[styles.saveButton, (!newCollectionName.trim() || creating) && styles.saveButtonDisabled]}>
                {creating ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Japan Trip 2024"
              placeholderTextColor={colors.textMuted}
              value={newCollectionName}
              onChangeText={setNewCollectionName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add a description..."
              placeholderTextColor={colors.textMuted}
              value={newCollectionDescription}
              onChangeText={setNewCollectionDescription}
              multiline
              numberOfLines={3}
            />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  createButtonText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  collectionImage: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  collectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  deleteButton: {
    padding: spacing.sm,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
