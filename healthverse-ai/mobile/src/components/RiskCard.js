import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, type, spacing, radius, shadow, risk } from '../theme';

export default function RiskCard({ result }) {
  if (!result) return null;
  const badgeColor = risk[result.risk_category] ?? colors.inkMuted;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={type.h2}>{result.condition}</Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{result.risk_category ?? '—'}</Text>
        </View>
      </View>

      {result.risk_percent != null && (
        <Text style={[type.display, { fontSize: 28, marginTop: spacing.xs }]}>
          {result.risk_percent}%
        </Text>
      )}

      {result.stage && (
        <Text style={[type.body, { marginTop: spacing.xs }]}>{result.stage} — {result.note}</Text>
      )}

      {result.reasoning && (
        <Text style={[type.body, { marginTop: spacing.xs }]}>{result.reasoning}</Text>
      )}

      {result.contributing_factors?.length > 0 && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={type.label}>TOP FACTORS</Text>
          {result.contributing_factors.map((f, i) => (
            <Text key={i} style={[type.caption, { marginTop: 2 }]}>
              • {f.factor} ({f.direction})
            </Text>
          ))}
        </View>
      )}

      {result.data_completeness && (
        <Text style={[type.caption, { marginTop: spacing.sm, fontStyle: 'italic' }]}>
          {result.data_completeness}
        </Text>
      )}

      {result.prevention_tips?.length > 0 && (
        <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          {result.prevention_tips.map((tip, i) => (
            <Text key={i} style={[type.body, { fontSize: 13, marginTop: 2 }]}>💡 {tip}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: colors.white, fontWeight: '700', fontSize: 12 },
});
