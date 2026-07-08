import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import HealthScoreRing from '../components/HealthScoreRing';
import SubScoreRow from '../components/SubScoreRow';

export default function HomeScreen({ navigation }) {
  const { lifestyle, riskResults, addScoreSnapshot } = useApp();
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.healthScore({
        heart_risk_pct: riskResults.heart?.risk_percent ?? null,
        hypertension_pct: riskResults.hypertension?.risk_percent ?? null,
        sleep_hours: lifestyle.sleepHours,
        sleep_quality_1to5: lifestyle.sleepQuality,
        stress_level_1to10: lifestyle.stressLevel,
        active_minutes_per_week: lifestyle.activeMinutes,
        fruit_veg_servings_per_day: lifestyle.fruitVeg,
      });
      setScore(result);
      if (result.overall != null) {
        addScoreSnapshot({ overall: result.overall, subScores: result.sub_scores });
      }
    } catch (e) {
      setError('Could not reach the server. Check API_BASE_URL in src/api/client.js and that the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [lifestyle, riskResults, addScoreSnapshot]);

  useEffect(() => { fetchScore(); }, [fetchScore]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchScore} tintColor={colors.primary} />}
    >
      <Text style={type.label}>TODAY</Text>
      <Text style={type.display}>Your Health Score</Text>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={[type.caption, { color: colors.accentCoral }]}>{error}</Text>
        </View>
      )}

      <View style={styles.ringCard}>
        <HealthScoreRing score={score?.overall} />
      </View>

      <View style={styles.card}>
        <Text style={type.h2}>Breakdown</Text>
        <View style={{ marginTop: spacing.sm }}>
          <SubScoreRow label="Heart" score={score?.sub_scores?.Heart} />
          <SubScoreRow label="Sleep" score={score?.sub_scores?.Sleep} />
          <SubScoreRow label="Stress" score={score?.sub_scores?.Stress} />
          <SubScoreRow label="Fitness" score={score?.sub_scores?.Fitness} />
          <SubScoreRow label="Nutrition" score={score?.sub_scores?.Nutrition} />
        </View>
        {score?.missing?.length > 0 && (
          <Text style={[type.caption, { marginTop: spacing.sm }]}>
            Missing: {score.missing.join(', ')} — check a risk assessment to fill these in.
          </Text>
        )}
      </View>

      <View style={styles.disclaimerCard}>
        <Text style={type.caption}>
          This score reflects general risk factors and self-reported habits — it isn't a
          diagnosis. Talk to a doctor about any concerning result.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  ringCard: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: spacing.xl, marginTop: spacing.lg, ...shadow.card,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.md, ...shadow.card,
  },
  errorBanner: {
    backgroundColor: '#FBEAE5', borderRadius: radius.md,
    padding: spacing.sm, marginTop: spacing.md,
  },
  disclaimerCard: {
    marginTop: spacing.md, paddingHorizontal: spacing.sm,
  },
});
