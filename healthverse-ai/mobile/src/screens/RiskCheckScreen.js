import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';
import { api } from '../api/client';
import LabeledInput from '../components/LabeledInput';
import ChipSelect from '../components/ChipSelect';

export default function RiskCheckScreen({ navigation }) {
  const { profile, setProfile, updateRisk } = useApp();
  const [form, setForm] = useState({
    age: profile.age ? String(profile.age) : '',
    sex: profile.sex ?? 'M',
    weightKg: profile.weightKg ? String(profile.weightKg) : '',
    heightCm: profile.heightCm ? String(profile.heightCm) : '',
    bpSystolic: '',
    bpDiastolic: '',
    glucose: '',
    cholesterol: '',
    smoker: false,
    familyHistory: 'none',
    physicallyActive: true,
    alcoholUse: 'none',
  });
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = async () => {
    const age = parseInt(form.age, 10);
    if (!age || !form.bpSystolic || !form.bpDiastolic) {
      Alert.alert('A few fields are missing', 'Age and blood pressure are needed for a meaningful result.');
      return;
    }

    setProfile({
      age, sex: form.sex,
      weightKg: parseFloat(form.weightKg) || null,
      heightCm: parseFloat(form.heightCm) || null,
    });

    const shared = {
      age,
      sex: form.sex,
      bp_systolic: parseFloat(form.bpSystolic),
      bp_diastolic: parseFloat(form.bpDiastolic),
      cholesterol: form.cholesterol ? parseFloat(form.cholesterol) : null,
      fasting_glucose_mgdl: form.glucose ? parseFloat(form.glucose) : null,
      smoker: form.smoker,
      family_history: form.familyHistory,
      weight_kg: parseFloat(form.weightKg) || null,
      height_cm: parseFloat(form.heightCm) || null,
      physically_active: form.physicallyActive,
    };

    setLoading(true);
    try {
      // Derived from already-collected vitals using the same public
      // thresholds used elsewhere (AHA Stage 1, ADA diabetes range) -
      // avoids asking the same yes/no questions twice in one form.
      const kidneyPayload = {
        age,
        bp_diastolic: shared.bp_diastolic,
        hypertensive: shared.bp_systolic >= 130 || shared.bp_diastolic >= 80,
        diabetic: shared.fasting_glucose_mgdl != null && shared.fasting_glucose_mgdl >= 126,
      };

      const [diabetes, heart, hypertension, stroke, kidney, liver] = await Promise.all([
        api.predictDiabetes({
          age, sex: form.sex,
          glucose_mgdl: shared.fasting_glucose_mgdl,
          bp_diastolic: shared.bp_diastolic,
          weight_kg: shared.weight_kg,
          height_cm: shared.height_cm,
          family_history: form.familyHistory,
        }),
        api.predictHeart(shared),
        api.predictHypertension(shared),
        api.predictStroke(shared),
        api.predictKidney(kidneyPayload),
        api.assessLiver({ age, sex: form.sex, alcohol_use: form.alcoholUse }),
      ]);
      updateRisk('diabetes', diabetes);
      updateRisk('heart', heart);
      updateRisk('hypertension', hypertension);
      updateRisk('stroke', stroke);
      updateRisk('kidney', kidney);
      updateRisk('liver', liver);
      navigation.navigate('RiskResult');
    } catch (e) {
      Alert.alert('Could not reach the server', 'Check that the backend is running and API_BASE_URL is set correctly in src/api/client.js.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>RISK CHECK</Text>
      <Text style={type.display}>How are you doing?</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        A few basics gets you diabetes, heart, kidney, liver, blood pressure, and stroke risk in one go.
      </Text>

      <View style={styles.card}>
        <LabeledInput label="Age" value={form.age} onChangeText={set('age')} placeholder="e.g. 42" />
        <ChipSelect
          label="Sex"
          options={[{ label: 'Male', value: 'M' }, { label: 'Female', value: 'F' }]}
          value={form.sex}
          onChange={set('sex')}
        />
        <View style={styles.rowSplit}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <LabeledInput label="Weight" unit="kg" value={form.weightKg} onChangeText={set('weightKg')} placeholder="70" />
          </View>
          <View style={{ flex: 1 }}>
            <LabeledInput label="Height" unit="cm" value={form.heightCm} onChangeText={set('heightCm')} placeholder="170" />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[type.h2, { marginBottom: spacing.sm }]}>Vitals</Text>
        <View style={styles.rowSplit}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <LabeledInput label="BP Systolic" unit="mmHg" value={form.bpSystolic} onChangeText={set('bpSystolic')} placeholder="120" />
          </View>
          <View style={{ flex: 1 }}>
            <LabeledInput label="BP Diastolic" unit="mmHg" value={form.bpDiastolic} onChangeText={set('bpDiastolic')} placeholder="80" />
          </View>
        </View>
        <LabeledInput label="Fasting blood sugar" unit="mg/dL" value={form.glucose} onChangeText={set('glucose')} placeholder="optional" />
        <LabeledInput label="Cholesterol" unit="mg/dL" value={form.cholesterol} onChangeText={set('cholesterol')} placeholder="optional, if you know it" />
      </View>

      <View style={styles.card}>
        <Text style={[type.h2, { marginBottom: spacing.sm }]}>Lifestyle</Text>
        <ChipSelect
          label="Do you smoke?"
          options={[{ label: 'No', value: false }, { label: 'Yes', value: true }]}
          value={form.smoker}
          onChange={set('smoker')}
        />
        <ChipSelect
          label="Physically active most weeks?"
          options={[{ label: 'Yes', value: true }, { label: 'No', value: false }]}
          value={form.physicallyActive}
          onChange={set('physicallyActive')}
        />
        <ChipSelect
          label="Alcohol use?"
          options={[
            { label: 'None', value: 'none' },
            { label: 'Moderate', value: 'moderate' },
            { label: 'Heavy', value: 'heavy' },
          ]}
          value={form.alcoholUse}
          onChange={set('alcoholUse')}
        />
        <ChipSelect
          label="Family history of these conditions?"
          options={[
            { label: 'None', value: 'none' },
            { label: 'One relative', value: 'one' },
            { label: 'Multiple', value: 'multiple' },
          ]}
          value={form.familyHistory}
          onChange={set('familyHistory')}
        />
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Check My Risk</Text>}
      </TouchableOpacity>

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.md }]}>
        This is a general risk screener, not a diagnosis.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadow.card,
  },
  rowSplit: { flexDirection: 'row' },
  submitButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm, ...shadow.card,
  },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
