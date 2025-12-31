import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { MapPin, Chrome, Github, Apple, Mail } from 'lucide-react-native';
import { colors, spacing, radius } from '../lib/colors';
import { useAuth } from '../lib/auth-context';

WebBrowser.maybeCompleteAuthSession();

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:5000';

export default function LoginScreen() {
  const { checkAuth } = useAuth();

  useEffect(() => {
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  async function handleDeepLink(event: { url: string }) {
    if (event.url.includes('auth/callback') || event.url.includes('venturr://')) {
      await checkAuth();
    }
  }

  async function handleLogin() {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_URL}/api/login?redirect=${encodeURIComponent(redirectUrl)}`,
        redirectUrl
      );
      
      if (result.type === 'success') {
        await checkAuth();
      }
    } catch (error) {
      Alert.alert('Login Failed', 'Unable to open login page. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MapPin size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>Venturr</Text>
          <Text style={styles.subtitle}>
            Collect travel recommendations from your favorite social posts
          </Text>
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <MapPin size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Save posts from TikTok & Instagram</Text>
              <Text style={styles.featureDescription}>Paste any travel video link</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <MapPin size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>AI extracts locations</Text>
              <Text style={styles.featureDescription}>Restaurants, hotels, attractions</Text>
            </View>
          </View>
          <View style={styles.feature}>
            <View style={styles.featureIcon}>
              <MapPin size={20} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>View on a map</Text>
              <Text style={styles.featureDescription}>Plan your perfect trip</Text>
            </View>
          </View>
        </View>

        <View style={styles.loginSection}>
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Get Started</Text>
          </TouchableOpacity>
          
          <Text style={styles.loginHint}>
            Sign in with Google, GitHub, Apple, or email
          </Text>

          <View style={styles.providers}>
            <View style={styles.providerIcon}>
              <Chrome size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.providerIcon}>
              <Github size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.providerIcon}>
              <Apple size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.providerIcon}>
              <Mail size={20} color={colors.textSecondary} />
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
    maxWidth: 280,
  },
  features: {
    gap: spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loginSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  loginButton: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md + 4,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  loginButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '600',
  },
  loginHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  providers: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
