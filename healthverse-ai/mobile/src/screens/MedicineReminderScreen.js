import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { colors, type, spacing, radius, shadow } from '../theme';
import ChipSelect from '../components/ChipSelect';
import { api } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TIME_PRESETS = [
  { label: 'Morning · 8 AM', hour: 8, minute: 0 },
  { label: 'Afternoon · 2 PM', hour: 14, minute: 0 },
  { label: 'Evening · 8 PM', hour: 20, minute: 0 },
  { label: 'Night · 10 PM', hour: 22, minute: 0 },
];

const CONFIDENCE_COLOR = { high: colors.primary, medium: colors.accentAmber, low: colors.accentCoral };
const SEVERITY_COLOR = { minor: colors.accentAmber, moderate: colors.accentCoral, major: colors.accentCoral };

export default function MedicineReminderScreen() {
  const [reminders, setReminders] = useState([]); // in-memory only, no backend yet
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [timePreset, setTimePreset] = useState(TIME_PRESETS[0]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [checkingInteractions, setCheckingInteractions] = useState(false);
  const [interactionResult, setInteractionResult] = useState(null);

  const checkInteractions = async () => {
    setCheckingInteractions(true);
    setInteractionResult(null);
    try {
      const data = await api.checkInteractions(reminders.map((r) => r.name));
      setInteractionResult(data);
    } catch (e) {
      Alert.alert('Could not check interactions', 'Check that the backend is running and your OpenAI key is set.');
    } finally {
      setCheckingInteractions(false);
    }
  };

  const scanPrescription = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access to scan a prescription.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return;

    setScanning(true);
    setScanResult(null);
    try {
      const data = await api.scanPrescription(result.assets[0].base64, result.assets[0].mimeType ?? 'image/jpeg');
      setScanResult(data);
    } catch (e) {
      Alert.alert('Could not read prescription', 'Check that the backend is running and your OpenAI key is set.');
    } finally {
      setScanning(false);
    }
  };

  const useSuggestion = (med) => {
    setName(med.name ?? '');
    setDosage(med.dosage ?? '');
    setScanResult(null);
  };

  const addReminder = async () => {
    if (!name.trim()) {
      Alert.alert('Medicine name needed', 'What are you taking?');
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Notifications disabled', 'Enable notifications to get reminded.');
      return;
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medicine reminder',
        body: dosage ? `Take ${name} — ${dosage}` : `Take ${name}`,
      },
      trigger: { hour: timePreset.hour, minute: timePreset.minute, repeats: true },
    });

    setReminders((prev) => [...prev, {
      id: notificationId, name, dosage, timeLabel: timePreset.label,
    }]);
    setName('');
    setDosage('');
  };

  const removeReminder = async (reminder) => {
    await Notifications.cancelScheduledNotificationAsync(reminder.id);
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>SMART MEDICINE</Text>
      <Text style={type.display}>Reminders</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Real local notifications, repeating daily at the time you pick.
      </Text>

      {reminders.map((r) => (
        <View key={r.id} style={styles.reminderCard}>
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{r.name}</Text>
            <Text style={type.caption}>{r.dosage ? `${r.dosage} · ` : ''}{r.timeLabel}</Text>
          </View>
          <TouchableOpacity onPress={() => removeReminder(r)}>
            <Text style={{ color: colors.accentCoral, fontWeight: '700', fontSize: 12 }}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      {reminders.length >= 2 && (
        <TouchableOpacity style={styles.interactionButton} onPress={checkInteractions} disabled={checkingInteractions}>
          {checkingInteractions ? <ActivityIndicator color={colors.white} /> : <Text style={styles.interactionButtonText}>Check interactions between these</Text>}
        </TouchableOpacity>
      )}

      {interactionResult && (
        <View style={styles.card}>
          {interactionResult.interactions?.length === 0 && (
            <Text style={type.body}>No notable interactions flagged - still worth confirming with a pharmacist.</Text>
          )}
          {interactionResult.interactions?.map((int, i) => (
            <View key={i} style={i > 0 ? styles.interactionRow : undefined}>
              <View style={styles.headerRow}>
                <Text style={type.body}>{int.drugs?.join(' + ')}</Text>
                <View style={[styles.confidenceBadge, { backgroundColor: SEVERITY_COLOR[int.severity] ?? colors.inkMuted }]}>
                  <Text style={styles.confidenceBadgeText}>{int.severity}</Text>
                </View>
              </View>
              <Text style={[type.caption, { marginTop: 2 }]}>{int.description}</Text>
            </View>
          ))}
          {interactionResult.note && <Text style={[type.caption, { marginTop: spacing.sm, fontStyle: 'italic' }]}>{interactionResult.note}</Text>}
        </View>
      )}

      <TouchableOpacity style={styles.scanButton} onPress={scanPrescription} disabled={scanning}>
        {scanning ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.scanButtonText}>Scan a prescription</Text>}
      </TouchableOpacity>

      {scanResult && (
        <View style={styles.card}>
          {!scanResult.legible && (
            <Text style={[type.caption, { color: colors.accentCoral, marginBottom: spacing.sm }]}>
              Hard to read - double-check these against the original before saving.
            </Text>
          )}
          {scanResult.medicines?.length === 0 && <Text style={type.body}>Couldn't identify any medicines in that photo.</Text>}
          {scanResult.medicines?.map((med, i) => (
            <TouchableOpacity key={i} style={styles.suggestionRow} onPress={() => useSuggestion(med)}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{med.name}</Text>
                <Text style={type.caption}>{med.dosage} {med.frequency ? `· ${med.frequency}` : ''}</Text>
              </View>
              <View style={[styles.confidenceBadge, { backgroundColor: CONFIDENCE_COLOR[med.confidence] ?? colors.inkMuted }]}>
                <Text style={styles.confidenceBadgeText}>{med.confidence}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {scanResult.note && <Text style={[type.caption, { marginTop: spacing.sm, fontStyle: 'italic' }]}>{scanResult.note}</Text>}
          <Text style={[type.caption, { marginTop: spacing.sm }]}>Tap a medicine to fill it into the form below - nothing gets added automatically.</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={[type.h2, { marginBottom: spacing.sm }]}>Add a reminder</Text>

        <Text style={type.label}>Medicine name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Metformin"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={type.label}>Dosage (optional)</Text>
        <TextInput
          style={styles.input}
          value={dosage}
          onChangeText={setDosage}
          placeholder="e.g. 500mg, 1 tablet"
          placeholderTextColor={colors.inkMuted}
        />

        <ChipSelect
          label="Reminder time"
          options={TIME_PRESETS.map((p) => ({ label: p.label, value: p.label }))}
          value={timePreset.label}
          onChange={(label) => setTimePreset(TIME_PRESETS.find((p) => p.label === label))}
        />

        <TouchableOpacity style={styles.addButton} onPress={addReminder}>
          <Text style={styles.addButtonText}>Set reminder</Text>
        </TouchableOpacity>
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }]}>
        Prescription scanning reads printed/handwritten text with GPT-4o vision - it can misread
        handwriting like anything else, which is why suggestions fill the form instead of
        creating a reminder directly. Interaction checking uses general medical knowledge, not a
        verified clinical database (the free API for that was discontinued in 2024) - always
        confirm anything flagged with a pharmacist. Pill-photo identification (matching a loose
        pill to a database by appearance) isn't included - NIH retired the one free public
        database for that in 2021 and nothing free replaced it.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  reminderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card,
  },
  scanButton: {
    borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', marginBottom: spacing.sm,
  },
  scanButtonText: { color: colors.primary, fontWeight: '700' },
  interactionButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm, ...shadow.card,
  },
  interactionButtonText: { color: colors.white, fontWeight: '700' },
  interactionRow: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  confidenceBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  confidenceBadgeText: { color: colors.white, fontWeight: '700', fontSize: 11 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.sm, ...shadow.card,
  },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.xs, marginBottom: spacing.md, ...type.body,
  },
  addButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs, ...shadow.card,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
});
