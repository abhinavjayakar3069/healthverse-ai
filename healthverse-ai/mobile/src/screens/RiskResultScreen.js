import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, type, spacing, radius } from '../theme';
import { useApp } from '../context/AppContext';
import RiskCard from '../components/RiskCard';

export default function RiskResultScreen({ navigation }) {
  const { riskResults } = useApp();
  const hasResults = Object.values(riskResults).some(Boolean);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>RESULTS</Text>
      <Text style={type.display}>Your Risk Snapshot</Text>

      {!hasResults && (
        <Text style={[type.body, { marginTop: spacing.lg }]}>
          No results yet — go back and run a risk check first.
        </Text>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <RiskCard result={riskResults.diabetes} />
        <RiskCard result={riskResults.heart} />
        <RiskCard result={riskResults.kidney} />
        <RiskCard result={riskResults.liver} />
        <RiskCard result={riskResults.hypertension} />
        <RiskCard result={riskResults.stroke} />
      </View>

      <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.homeButtonText}>See it reflected in my Health Score</Text>
      </TouchableOpacity>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }]}>
        These are general risk-factor estimates, not a diagnosis. If any result concerns you,
        please talk to a doctor.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  homeButton: {
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  homeButtonText: { color: colors.primary, fontWeight: '700' },
});
