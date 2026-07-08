import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Share, Alert } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';

export default function DoctorReportScreen() {
  const { profile, riskResults, scoreHistory, lifestyle } = useApp();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const hasAnyData = Object.values(riskResults).some(Boolean) || scoreHistory.length > 0;

  const generate = async () => {
    setLoading(true);
    try {
      const patientData = {
        profile,
        lifestyle,
        risk_assessments: riskResults,
        health_score_history: scoreHistory,
      };
      const result = await api.doctorReport(patientData);
      setReport(result.report);
    } catch (e) {
      Alert.alert('Could not generate report', 'Check that the backend is running and your OpenAI key is set.');
    } finally {
      setLoading(false);
    }
  };

  const shareReport = async () => {
    try {
      await Share.share({ message: report });
    } catch (e) {
      // Share sheet dismissed or failed silently - not worth alerting over
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>DOCTOR REPORT</Text>
      <Text style={type.display}>Bring this to your visit</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Turns what you've entered into a summary a doctor can read in under a minute.
      </Text>

      {!hasAnyData && (
        <View style={styles.card}>
          <Text style={type.body}>
            No data yet — run a Risk Check or open Home to log a health score first, then
            come back here.
          </Text>
        </View>
      )}

      {hasAnyData && !report && (
        <TouchableOpacity style={styles.generateButton} onPress={generate} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.generateButtonText}>Generate report</Text>}
        </TouchableOpacity>
      )}

      {report && (
        <View style={styles.card}>
          <Text style={type.body}>{report}</Text>
          <TouchableOpacity style={styles.shareButton} onPress={shareReport}>
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={generate} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
            <Text style={[type.caption, { color: colors.primary, fontWeight: '700' }]}>Regenerate</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }]}>
        This is the "view reports, AI summaries" part of the original Doctor Dashboard idea.
        Live chat with a doctor and video consultation aren't included — those need real
        backend accounts and a video calling service (Twilio/Agora/Daily.co), which isn't
        set up here. All data is self-reported through this app, not clinically verified —
        the report says so explicitly for the doctor's benefit.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.md, ...shadow.card,
  },
  generateButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md, ...shadow.card,
  },
  generateButtonText: { color: colors.white, fontWeight: '700' },
  shareButton: {
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md,
  },
  shareButtonText: { color: colors.primary, fontWeight: '700' },
});
