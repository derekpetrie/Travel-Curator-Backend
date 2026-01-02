import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Check, X, FolderOpen } from 'lucide-react-native';
import { colors, spacing, radius } from '../lib/colors';
import { useShareIntentContext } from '../lib/share-intent-context';
import { Collection } from '../lib/api';

export function ShareIntentModal() {
  const { sharedUrl, isProcessing, collections, clearSharedUrl, addToCollection } = useShareIntentContext();
  
  if (!sharedUrl) return null;

  const handleSelectCollection = async (collection: Collection) => {
    const success = await addToCollection(collection.id);
    if (success) {
    }
  };

  const renderCollection = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.collectionItem}
      onPress={() => handleSelectCollection(item)}
      disabled={isProcessing}
    >
      <View style={[
        styles.collectionIcon,
        item.coverGradient ? { backgroundColor: item.coverGradient.split(',')[0] } : null
      ]}>
        <FolderOpen size={20} color={colors.textSecondary} />
      </View>
      <Text style={styles.collectionTitle} numberOfLines={1}>
        {item.title}
      </Text>
      {isProcessing && (
        <ActivityIndicator size="small" color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  const displayUrl = sharedUrl.length > 50 ? sharedUrl.substring(0, 50) + '...' : sharedUrl;

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={clearSharedUrl}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={clearSharedUrl} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Save to Venturr</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.urlPreview}>
          <Text style={styles.urlLabel}>Saving link:</Text>
          <Text style={styles.urlText} numberOfLines={2}>{displayUrl}</Text>
        </View>

        {collections.length === 0 ? (
          <View style={styles.emptyState}>
            <FolderOpen size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No Venturrs yet</Text>
            <Text style={styles.emptySubtext}>Create a Venturr first in the app</Text>
          </View>
        ) : (
          <>
            <Text style={styles.selectLabel}>Select a Venturr:</Text>
            <FlatList
              data={collections}
              renderItem={renderCollection}
              keyExtractor={(item) => item.id.toString()}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 32,
  },
  urlPreview: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  urlLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  urlText: {
    fontSize: 14,
    color: colors.text,
  },
  selectLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  collectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  collectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
