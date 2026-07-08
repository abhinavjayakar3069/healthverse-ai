import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { colors, type, spacing, radius, shadow } from '../theme';
import HealthScoreRing from '../components/HealthScoreRing';
import ChipSelect from '../components/ChipSelect';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

const DAILY_GOAL = 8000; // Research on step counts and health outcomes (e.g.
// Lee et al.) suggests benefits plateau somewhere in the 7,000-10,000/day
// range for adults - not a precise clinical threshold, just a reasonable
// target, not the often-repeated but weakly-sourced "10,000 steps" figure.

const GOALS = [
  { label: 'General fitness', value: 'general_fitness' },
  { label: 'Strength', value: 'strength' },
  { label: 'Cardio', value: 'cardio' },
  { label: 'Weight loss', value: 'weight_loss' },
];
const EXPERIENCE = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Advanced', value: 'advanced' },
];
const EQUIPMENT = [
  { label: 'None', value: 'none' },
  { label: 'Basic home', value: 'home_basic' },
  { label: 'Full gym', value: 'full_gym' },
];
const DAYS = [2, 3, 4, 5, 6].map((d) => ({ label: String(d), value: d }));

export default function FitnessScreen() {
  const { profile } = useApp();
  const [available, setAvailable] = useState(null);
  const [steps, setSteps] = useState(null);
  const [error, setError] = useState(null);

  const [goal, setGoal] = useState('general_fitness');
  const [experience, setExperience] = useState('beginner');
  const [equipment, setEquipment] = useState('none');
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [injuriesNotes, setInjuriesNotes] = useState('');
  const [plan, setPlan] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let subscription;

    (async () => {
      try {
        const isAvailable = await Pedometer.isAvailableAsync();
        setAvailable(isAvailable);
        if (!isAvailable) return;

        const permission = await Pedometer.requestPermissionsAsync?.();
        if (permission && permission.status !== 'granted') {
          setError('Motion & fitness permission needed to count steps.');
          return;
        }

        const end = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0); // midnight today

        const result = await Pedometer.getStepCountAsync(start, end);
        setSteps(result.steps);

        subscription = Pedometer.watchStepCount((update) => {
          setSteps((prev) => (prev ?? 0) + update.steps);
        });
      } catch (e) {
        setError('Could not read step data from this device.');
      }
    })();

    return () => subscription?.remove();
  }, []);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const result = await api.workoutPlan({
        goal, experience, equipment, days_per_week: daysPerWeek,
        age: profile.age, sex: profile.sex,
        injuries_notes: injuriesNotes.trim() || null,
      });
      setPlan(result.plan);
    } catch (e) {
      Alert.alert('Could not generate plan', 'Check that the backend is running and your OpenAI key is set.');
    } finally {
      setGenerating(false);
    }
  };

  const pct = steps != null ? Math.min(100, Math.round((steps / DAILY_GOAL) * 100)) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>FITNESS</Text>
      <Text style={type.display}>Today's steps</Text>

      <View style={styles.card}>
        {available === null && <ActivityIndicator color={colors.primary} />}

        {available === false && (
          <Text style={type.body}>
            Step counting isn't available on this device/simulator. Real hardware needed - most
            simulators don't emulate motion sensors.
          </Text>
        )}

        {error && <Text style={[type.body, { color: colors.accentCoral }]}>{error}</Text>}

        {available && steps != null && (
          <>
            <HealthScoreRing score={pct} size={160} />
            <Text style={[type.h2, { marginTop: spacing.md }]}>{steps.toLocaleString()} steps</Text>
            <Text style={type.caption}>Goal: {DAILY_GOAL.toLocaleString()}/day</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={[type.h2, { marginBottom: spacing.sm }]}>Workout plan</Text>
        <ChipSelect label="Goal" options={GOALS} value={goal} onChange={setGoal} />
        <ChipSelect label="Experience" options={EXPERIENCE} value={experience} onChange={setExperience} />
        <ChipSelect label="Equipment" options={EQUIPMENT} value={equipment} onChange={setEquipment} />
        <ChipSelect label="Days per week" options={DAYS} value={daysPerWeek} onChange={setDaysPerWeek} />

        <Text style={type.label}>Any injuries or conditions? (optional)</Text>
        <TextInput
          style={styles.injuriesInput}
          value={injuriesNotes}
          onChangeText={setInjuriesNotes}
          placeholder="e.g. bad left knee, lower back pain"
          placeholderTextColor={colors.inkMuted}
          multiline
        />

        <TouchableOpacity style={styles.generateButton} onPress={generatePlan} disabled={generating}>
          {generating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.generateButtonText}>Generate plan</Text>}
        </TouchableOpacity>

        {plan && <Text style={[type.body, { marginTop: spacing.md }]}>{plan}</Text>}
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg }]}>
        Steps come straight from your phone's motion sensor - no wearable or account
        needed. The workout plan is AI-generated text, not a certified trainer's program;
        it's told to defer to a doctor/physio first if you mention an injury. Neither of
        these is tested by me - no motion sensors or live API access in my sandbox. Cross-
        device wearable sync (Health Connect/HealthKit) has real integration code written
        (src/hooks/useHealthPlatformSteps.js) but isn't active - needs a custom native
        build beyond plain Expo Go, see mobile README.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.lg, alignItems: 'center', ...shadow.card,
  },
  generateButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm,
    alignSelf: 'stretch', ...shadow.card,
  },
  generateButtonText: { color: colors.white, fontWeight: '700' },
  injuriesInput: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.xs, marginBottom: spacing.sm, minHeight: 50,
    textAlignVertical: 'top', ...type.body,
  },
});
