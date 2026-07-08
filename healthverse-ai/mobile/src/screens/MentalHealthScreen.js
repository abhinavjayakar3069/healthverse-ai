import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';

const MOODS = [
  { emoji: '😞', label: 'Low', value: 1 },
  { emoji: '😕', label: 'Meh', value: 2 },
  { emoji: '😐', label: 'Okay', value: 3 },
  { emoji: '🙂', label: 'Good', value: 4 },
  { emoji: '😄', label: 'Great', value: 5 },
];

const BREATH_PHASES = [
  { label: 'Breathe in', seconds: 4 },
  { label: 'Hold', seconds: 4 },
  { label: 'Breathe out', seconds: 6 },
];

export default function MentalHealthScreen() {
  const { moodCheckins, addMoodCheckin } = useApp();
  const [selectedMood, setSelectedMood] = useState(null);
  const [breathing, setBreathing] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(BREATH_PHASES[0].seconds);
  const intervalRef = useRef(null);
  // Refs hold the "live" values the interval reads/writes - state is just for
  // rendering. Avoids a stale-closure bug where the interval's captured
  // phaseIndex never advances (verified this the hard way - see chat).
  const phaseIndexRef = useRef(0);
  const countdownRef = useRef(BREATH_PHASES[0].seconds);

  const logMood = (moodValue) => {
    setSelectedMood(moodValue);
    addMoodCheckin(moodValue);
  };

  useEffect(() => {
    if (!breathing) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) {
        phaseIndexRef.current = (phaseIndexRef.current + 1) % BREATH_PHASES.length;
        countdownRef.current = BREATH_PHASES[phaseIndexRef.current].seconds;
      }
      setPhaseIndex(phaseIndexRef.current);
      setCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [breathing]);

  const toggleBreathing = () => {
    if (breathing) {
      setBreathing(false);
    } else {
      phaseIndexRef.current = 0;
      countdownRef.current = BREATH_PHASES[0].seconds;
      setPhaseIndex(0);
      setCountdown(BREATH_PHASES[0].seconds);
      setBreathing(true);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>MENTAL HEALTH</Text>
      <Text style={type.display}>How are you feeling?</Text>

      <View style={styles.card}>
        <View style={styles.moodRow}>
          {MOODS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.moodButton, selectedMood === m.value && styles.moodButtonActive]}
              onPress={() => logMood(m.value)}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
              <Text style={[type.caption, selectedMood === m.value && { color: colors.primary, fontWeight: '700' }]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {moodCheckins.length > 0 && (
          <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={type.label}>RECENT CHECK-INS</Text>
            {moodCheckins.slice(0, 5).map((c, i) => (
              <Text key={i} style={[type.caption, { marginTop: 4 }]}>
                {MOODS.find((m) => m.value === c.mood)?.emoji} {MOODS.find((m) => m.value === c.mood)?.label} — {new Date(c.at).toLocaleTimeString()}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={[type.h2, { marginBottom: spacing.sm }]}>Breathing exercise</Text>
        <Text style={[type.caption, { marginBottom: spacing.md }]}>4 seconds in, 4 hold, 6 out — repeats until you stop.</Text>

        <View style={styles.breathCircleWrap}>
          <View style={[styles.breathCircle, breathing && styles.breathCircleActive]}>
            <Text style={styles.breathLabel}>{breathing ? BREATH_PHASES[phaseIndex].label : 'Ready'}</Text>
            <Text style={styles.breathCountdown}>{breathing ? countdown : ''}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.breathButton} onPress={toggleBreathing}>
          <Text style={styles.breathButtonText}>{breathing ? 'Stop' : 'Start breathing exercise'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xl }]}>
        Mood history is saved on this device (not synced to any account or server). If
        you're struggling, please reach out to a real person or professional — this screen
        is a small tool, not a substitute for support.
      </Text>
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
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodButton: { alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, flex: 1 },
  moodButtonActive: { backgroundColor: colors.primarySoft },
  moodEmoji: { fontSize: 28, marginBottom: 4 },
  breathCircleWrap: { alignItems: 'center', marginVertical: spacing.md },
  breathCircle: {
    width: 160, height: 160, borderRadius: 80, backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border,
  },
  breathCircleActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  breathLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  breathCountdown: { fontSize: 32, fontWeight: '700', color: colors.primary, marginTop: 4 },
  breathButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, ...shadow.card,
  },
  breathButtonText: { color: colors.white, fontWeight: '700' },
});
