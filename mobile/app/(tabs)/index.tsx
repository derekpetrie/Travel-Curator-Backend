import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, MapPin } from 'lucide-react-native';
import { colors, spacing, radius } from '../../lib/colors';
import { collectionsApi, Collection, Place } from '../../lib/api';

function parseGradient(gradient: string | null | undefined): [string, string] {
  if (!gradient) return [colors.primary, colors.primaryLight];
  const parts = gradient.split(',').map(s => s.trim());
  return [parts[0] || colors.primary, parts[1] || colors.primaryLight];
}

export default function HomeScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const collectionsData = await collectionsApi.getAll();
      setCollections(collectionsData);
      
      const allPlaces: Place[] = [];
      for (const collection of collectionsData.slice(0, 3)) {
        const places = await collectionsApi.getPlaces(collection.id);
        allPlaces.push(...places);
      }
      setRecentPlaces(allPlaces.slice(0, 5));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Venturr</Text>
          <Text style={styles.subtitle}>Your travel discoveries</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your collections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Venturr</Text>
          <Text style={styles.subtitle}>Your travel discoveries</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Collections</Text>
            <TouchableOpacity onPress={() => router.push('/collections')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {collections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No collections yet</Text>
              <TouchableOpacity style={styles.createButton} onPress={() => router.push('/collections')}>
                <Plus size={20} color={colors.background} />
                <Text style={styles.createButtonText}>Create your first</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {collections.slice(0, 5).map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  style={styles.collectionCard}
                  onPress={() => router.push(`/collection/${collection.id}`)}
                >
                  {collection.coverImage ? (
                    <Image 
                      source={{ uri: collection.coverImage }} 
                      style={styles.collectionImage}
                    />
                  ) : (
                    <LinearGradient
                      colors={parseGradient(collection.coverGradient)}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.collectionImage}
                    >
                      <MapPin size={24} color={colors.background} />
                    </LinearGradient>
                  )}
                  <Text style={styles.collectionName} numberOfLines={1}>
                    {collection.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Places</Text>
          {recentPlaces.length === 0 ? (
            <Text style={styles.emptyText}>Add posts to discover places</Text>
          ) : (
            recentPlaces.map((place) => (
              <View key={place.id} style={styles.placeCard}>
                <View style={styles.placeIcon}>
                  <MapPin size={20} color={colors.primary} />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  {place.address && (
                    <Text style={styles.placeAddress} numberOfLines={1}>
                      {place.address}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  horizontalScroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  collectionCard: {
    width: 140,
    marginRight: spacing.md,
  },
  collectionImage: {
    width: 140,
    height: 100,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  collectionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  createButtonText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 14,
  },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  placeIcon: {
    width: 40,
    height: 40,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  placeAddress: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
});
