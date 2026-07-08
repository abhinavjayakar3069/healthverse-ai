import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, type, spacing, radius, shadow } from '../theme';
import { api } from '../api/client';

const CONFIDENCE_COLOR = { high: colors.primary, medium: colors.accentAmber, low: colors.accentCoral };

export default function NutritionScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = async (asset) => {
    setImageUri(asset.uri);
    setResult(null);
    setAnalyzing(true);
    try {
      const data = await api.analyzeMealPhoto(asset.base64, asset.mimeType ?? 'image/jpeg');
      setResult(data);
    } catch (e) {
      Alert.alert('Could not analyze photo', 'Check that the backend is running and your OpenAI key is set.');
    } finally {
      setAnalyzing(false);
    }
  };

  const pickFrom = async (source) => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', `Enable ${source === 'camera' ? 'camera' : 'photo library'} access to use this.`);
      return;
    }

    const launch = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      base64: true,
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]) {
      analyze(result.assets[0]);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>NUTRITION</Text>
      <Text style={type.display}>What are you eating?</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Snap or pick a photo — estimates are approximate, like any photo-based tool.
      </Text>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.captureButton} onPress={() => pickFrom('camera')}>
          <Text style={styles.captureButtonText}>Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureButtonOutline} onPress={() => pickFrom('library')}>
          <Text style={styles.captureButtonOutlineText}>Choose from gallery</Text>
        </TouchableOpacity>
      </View>

      {analyzing && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[type.caption, { marginLeft: spacing.sm }]}>Analyzing meal…</Text>
        </View>
      )}

      {result && (
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={type.h2}>{result.items?.join(', ') ?? 'Meal'}</Text>
            <View style={[styles.badge, { backgroundColor: CONFIDENCE_COLOR[result.confidence] ?? colors.inkMuted }]}>
              <Text style={styles.badgeText}>{result.confidence ?? '—'} confidence</Text>
            </View>
          </View>

          <View style={styles.macroGrid}>
            <Macro label="Calories" value={result.calories} unit="" />
            <Macro label="Protein" value={result.protein_g} unit="g" />
            <Macro label="Carbs" value={result.carbs_g} unit="g" />
            <Macro label="Fat" value={result.fat_g} unit="g" />
            <Macro label="Sugar" value={result.sugar_g} unit="g" />
          </View>

          {result.note && (
            <Text style={[type.caption, { marginTop: spacing.sm, fontStyle: 'italic' }]}>{result.note}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Macro({ label, value, unit }) {
  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroValue}>{value ?? '—'}{unit}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  preview: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, marginBottom: spacing.md },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  captureButton: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', ...shadow.card,
  },
  captureButtonText: { color: colors.white, fontWeight: '700' },
  captureButtonOutline: {
    flex: 1, borderRadius: radius.pill, paddingVertical: spacing.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  captureButtonOutlineText: { color: colors.ink, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.lg, ...shadow.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.md, gap: spacing.md },
  macroItem: { width: '28%' },
  macroValue: { fontSize: 20, fontWeight: '700', color: colors.ink },
});
