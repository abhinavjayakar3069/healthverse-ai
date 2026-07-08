import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, type, spacing, radius } from '../theme';

const ICONS = { Heart: '❤️', Sleep: '😴', Stress: '😌', Fitness: '💪', Nutrition: '🥗' };

export default function SubScoreRow({ label, score }) {
  const known = score != null;
  const barColor = !known ? colors.border : score >= 75 ? colors.primary : score >= 50 ? colors.accentAmber : colors.accentCoral;

  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{ICONS[label] ?? '•'}</Text>
      <Text style={[type.body, styles.label]}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${known ? score : 0}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[type.caption, styles.value]}>{known ? Math.round(score) : '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  icon: { fontSize: 18, width: 28 },
  label: { width: 84 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, marginHorizontal: spacing.sm, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  value: { width: 32, textAlign: 'right' },
});
