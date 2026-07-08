import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, type, spacing, radius } from '../theme';
import { api } from '../api/client';

// NOT wired into RootNavigator - requires a custom Expo dev client
// (@daily-co/react-native-daily-js contains native code Expo Go doesn't
// bundle) AND a real Daily.co account (DAILY_API_KEY on the backend).
// Genuinely unverified - no dev client, no account, no internet in my
// sandbox to try any of this. See backend/app/environment.py and
// mobile/README.md's doctor video section for full activation steps.
//
// Once activated (dev client + DAILY_API_KEY set), wire this into
// RootNavigator's More stack the same way DoctorReportScreen is, and
// replace the require() below with a real import - it's deferred here
// so this file doesn't crash on import in the current Expo Go setup.
export default function DoctorVideoScreen() {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const callObjectRef = useRef(null);

  useEffect(() => {
    return () => { callObjectRef.current?.leave?.(); };
  }, []);

  const startCall = async () => {
    setJoining(true);
    setError(null);
    try {
      const { room_url } = await api.createVideoRoom();
      const Daily = require('@daily-co/react-native-daily-js').default;
      const call = Daily.createCallObject();
      callObjectRef.current = call;
      await call.join({ url: room_url });
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={type.label}>DOCTOR VIDEO</Text>
      <Text style={type.display}>Video consultation</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.sm }]}>
        Not active yet - needs a custom dev client and a Daily.co account. See
        mobile/README.md before trying this button.
      </Text>

      {error && <Text style={[type.body, { color: colors.accentCoral, marginTop: spacing.md }]}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={startCall} disabled={joining}>
        {joining ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Start call</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  button: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg,
  },
  buttonText: { color: colors.white, fontWeight: '700' },
});
