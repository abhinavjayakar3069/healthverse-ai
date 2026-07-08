import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Linking, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';
import ChipSelect from '../components/ChipSelect';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function EmergencySOSScreen() {
  const { emergency, setEmergency } = useApp();
  const [locating, setLocating] = useState(false);

  const set = (key) => (val) => setEmergency((e) => ({ ...e, [key]: val }));

  const getLocationLink = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Enable location access to share it in an emergency.');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      return `https://maps.google.com/?q=${latitude},${longitude}`;
    } catch (e) {
      Alert.alert('Could not get location', 'Check your device location settings and try again.');
      return null;
    } finally {
      setLocating(false);
    }
  };

  const callContact = () => {
    if (!emergency.contactPhone) {
      Alert.alert('No emergency contact set', 'Add a phone number below first.');
      return;
    }
    Linking.openURL(`tel:${emergency.contactPhone}`);
  };

  const sendLocationSMS = async () => {
    if (!emergency.contactPhone) {
      Alert.alert('No emergency contact set', 'Add a phone number below first.');
      return;
    }
    const mapsLink = await getLocationLink();
    const parts = ['This is an emergency alert.'];
    if (mapsLink) parts.push(`My location: ${mapsLink}`);
    if (emergency.bloodGroup) parts.push(`Blood group: ${emergency.bloodGroup}`);
    if (emergency.medicalNotes) parts.push(`Medical notes: ${emergency.medicalNotes}`);
    const body = encodeURIComponent(parts.join(' '));
    Linking.openURL(`sms:${emergency.contactPhone}?body=${body}`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>EMERGENCY</Text>
      <Text style={type.display}>SOS</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        One tap shares your location and medical basics with your emergency contact.
      </Text>

      <TouchableOpacity style={styles.sosButton} onPress={sendLocationSMS} disabled={locating}>
        {locating ? (
          <ActivityIndicator color={colors.white} size="large" />
        ) : (
          <>
            <Text style={styles.sosText}>Send SOS</Text>
            <Text style={styles.sosSubtext}>Texts location + medical info to your contact</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.callButton} onPress={callContact}>
        <Text style={styles.callButtonText}>Call emergency contact directly</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={[type.h2, { marginBottom: spacing.sm }]}>Your emergency info</Text>

        <ChipSelect
          label="Blood group"
          options={BLOOD_GROUPS.map((g) => ({ label: g, value: g }))}
          value={emergency.bloodGroup}
          onChange={set('bloodGroup')}
        />

        <Text style={type.label}>Emergency contact name</Text>
        <TextInput
          style={styles.input}
          value={emergency.contactName}
          onChangeText={set('contactName')}
          placeholder="e.g. Priya (sister)"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={[type.label, { marginTop: spacing.md }]}>Emergency contact phone</Text>
        <TextInput
          style={styles.input}
          value={emergency.contactPhone}
          onChangeText={set('contactPhone')}
          placeholder="+91…"
          placeholderTextColor={colors.inkMuted}
          keyboardType="phone-pad"
        />

        <Text style={[type.label, { marginTop: spacing.md }]}>Medical notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          value={emergency.medicalNotes}
          onChangeText={set('medicalNotes')}
          placeholder="Allergies, conditions, medications…"
          placeholderTextColor={colors.inkMuted}
          multiline
        />
      </View>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xl }]}>
        This sends an SMS through your phone's normal messaging — nothing is transmitted
        through our servers, and no authority is automatically notified.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sosButton: {
    backgroundColor: colors.accentCoral, borderRadius: radius.lg,
    paddingVertical: spacing.lg, alignItems: 'center', ...shadow.card,
  },
  sosText: { color: colors.white, fontWeight: '700', fontSize: 22 },
  sosSubtext: { color: colors.white, fontSize: 12, marginTop: 4, opacity: 0.9 },
  callButton: {
    borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center',
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  callButtonText: { color: colors.ink, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginTop: spacing.lg, ...shadow.card,
  },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.xs, ...type.body,
  },
});
