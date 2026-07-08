import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location';
import { colors, type, spacing, radius, shadow } from '../theme';
import { api } from '../api/client';

const CATEGORY_COLOR = {
  Good: colors.primary,
  Moderate: colors.accentAmber,
  'Unhealthy for Sensitive Groups': colors.accentAmber,
  Unhealthy: colors.accentCoral,
  'Very Unhealthy': colors.accentCoral,
  Hazardous: colors.accentCoral,
};

export default function OutbreakScreen() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchAirQuality = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission needed to look up air quality near you.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const result = await api.airQuality(`geo:${pos.coords.latitude};${pos.coords.longitude}`);
      if (!result.available) {
        setError('No monitoring station found near your exact location. Try again from a different spot, or check a nearby city directly.');
        return;
      }
      setData(result);
    } catch (e) {
      setError('Could not reach the server, or the AQICN_TOKEN env var is not set on the backend — see backend/app/environment.py.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAirQuality(); }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>ENVIRONMENT</Text>
      <Text style={type.display}>Air quality near you</Text>

      <View style={styles.card}>
        {loading && (
          <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {!loading && error && (
          <Text style={[type.body, { color: colors.accentCoral }]}>{error}</Text>
        )}

        {!loading && data && (
          <>
            <View style={styles.headerRow}>
              <Text style={[type.display, { fontSize: 40 }]}>{data.aqi}</Text>
              <View style={[styles.badge, { backgroundColor: CATEGORY_COLOR[data.category] ?? colors.inkMuted }]}>
                <Text style={styles.badgeText}>{data.category}</Text>
              </View>
            </View>
            <Text style={[type.caption, { marginTop: 4 }]}>{data.station}</Text>
            <Text style={[type.body, { marginTop: spacing.sm }]}>{data.advice}</Text>

            {data.pollutants && Object.keys(data.pollutants).length > 0 && (
              <View style={styles.pollutantRow}>
                {Object.entries(data.pollutants).map(([key, val]) => (
                  <View key={key} style={styles.pollutantChip}>
                    <Text style={styles.pollutantLabel}>{key.toUpperCase()}</Text>
                    <Text style={styles.pollutantValue}>{val}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.refreshButton} onPress={fetchAirQuality} disabled={loading}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.comingSoonCard}>
        <Text style={type.h2}>Dengue, flu, and COVID alerts</Text>
        <Text style={[type.caption, { marginTop: spacing.xs }]}>
          Not included. India's real disease-surveillance data (IDSP) isn't published as a
          public API — this would need either a data-sharing agreement or a much weaker,
          non-local substitute like WHO's global outbreak feed. See AUDIT.md.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.lg, ...shadow.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
  pollutantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  pollutantChip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' },
  pollutantLabel: { fontSize: 10, color: colors.inkMuted, fontWeight: '700' },
  pollutantValue: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  refreshButton: {
    marginTop: spacing.md, borderRadius: radius.pill, paddingVertical: spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  refreshButtonText: { color: colors.ink, fontWeight: '600' },
  comingSoonCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.md,
  },
});
