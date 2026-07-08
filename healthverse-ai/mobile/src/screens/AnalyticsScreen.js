import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';

const CHART_W = 300;
const CHART_H = 140;
const PAD = 16;

function points(values) {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) {
    return [[CHART_W / 2, PAD + (CHART_H - 2 * PAD) * (1 - values[0] / 100)]];
  }
  return values.map((v, i) => {
    const x = PAD + (i * (CHART_W - 2 * PAD)) / (n - 1);
    const y = PAD + (CHART_H - 2 * PAD) * (1 - v / 100);
    return [x, y];
  });
}

export default function AnalyticsScreen() {
  const { scoreHistory } = useApp();
  const values = scoreHistory.map((s) => s.overall);
  const pts = points(values);
  const polylineStr = pts.map(([x, y]) => `${x},${y}`).join(' ');

  const latest = scoreHistory[scoreHistory.length - 1];
  const first = scoreHistory[0];
  const trend = latest && first && scoreHistory.length > 1 ? latest.overall - first.overall : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>HEALTH ANALYTICS</Text>
      <Text style={type.display}>Your trend</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Every time you open Home, a snapshot gets added here.
      </Text>

      <View style={styles.card}>
        {scoreHistory.length === 0 ? (
          <Text style={type.body}>No history yet — visit Home to log your first snapshot.</Text>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={type.h2}>Overall score</Text>
              {scoreHistory.length > 1 && (
                <Text style={[type.caption, { fontWeight: '700', color: trend >= 0 ? colors.primary : colors.accentCoral }]}>
                  {trend >= 0 ? '+' : ''}{trend} since first snapshot
                </Text>
              )}
            </View>

            <Svg width={CHART_W} height={CHART_H} style={{ marginTop: spacing.sm }}>
              {[25, 50, 75].map((v) => {
                const y = PAD + (CHART_H - 2 * PAD) * (1 - v / 100);
                return <Line key={v} x1={PAD} y1={y} x2={CHART_W - PAD} y2={y} stroke={colors.border} strokeWidth={1} />;
              })}
              {pts.length > 1 && (
                <Polyline points={polylineStr} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {pts.map(([x, y], i) => (
                <Circle key={i} cx={x} cy={y} r={4} fill={colors.primary} />
              ))}
            </Svg>

            <Text style={[type.caption, { marginTop: spacing.sm }]}>
              {scoreHistory.length} snapshot{scoreHistory.length === 1 ? '' : 's'} saved · latest {latest.overall}/100
            </Text>
          </>
        )}
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }]}>
        Saved on this device now (AsyncStorage) — survives an app restart, but stays on
        this phone only. A real cross-device version would need server-side storage tied
        to an account, which isn't built.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, ...shadow.card,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
