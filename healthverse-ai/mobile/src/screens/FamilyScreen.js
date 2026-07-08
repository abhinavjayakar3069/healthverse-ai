import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';
import ChipSelect from '../components/ChipSelect';

const RELATIONS = ['Parent', 'Child', 'Spouse', 'Sibling', 'Grandparent', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'];

const BLANK_FORM = { name: '', relation: 'Parent', age: '', sex: 'M', bloodGroup: 'Unknown', conditions: '' };

export default function FamilyScreen() {
  const { familyMembers, addFamilyMember, removeFamilyMember } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const save = () => {
    if (!form.name.trim()) {
      Alert.alert('Name needed', 'Add a name so you can tell members apart.');
      return;
    }
    addFamilyMember({
      ...form,
      age: form.age ? parseInt(form.age, 10) : null,
    });
    setForm(BLANK_FORM);
    setShowForm(false);
  };

  const confirmRemove = (member) => {
    Alert.alert('Remove member', `Remove ${member.name} from your family list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFamilyMember(member.id) },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>FAMILY HEALTH</Text>
      <Text style={type.display}>Your family</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Keep parents, kids, and other family members' basics in one place.
      </Text>

      {familyMembers.length === 0 && !showForm && (
        <View style={styles.emptyCard}>
          <Text style={type.body}>No family members added yet.</Text>
        </View>
      )}

      {familyMembers.map((m) => (
        <View key={m.id} style={styles.memberCard}>
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{m.name}</Text>
            <Text style={type.caption}>
              {m.relation} • {m.age ? `${m.age} yrs` : 'age unknown'} • {m.bloodGroup}
            </Text>
            {m.conditions ? (
              <Text style={[type.caption, { marginTop: 4 }]}>Conditions: {m.conditions}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => confirmRemove(m)} style={styles.removeButton}>
            <Text style={{ color: colors.accentCoral, fontWeight: '700', fontSize: 12 }}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}

      {showForm ? (
        <View style={styles.card}>
          <Text style={[type.h2, { marginBottom: spacing.sm }]}>Add family member</Text>

          <Text style={type.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={set('name')}
            placeholder="e.g. Amma"
            placeholderTextColor={colors.inkMuted}
          />

          <ChipSelect label="Relation" options={RELATIONS.map((r) => ({ label: r, value: r }))} value={form.relation} onChange={set('relation')} />
          <ChipSelect label="Sex" options={[{ label: 'Male', value: 'M' }, { label: 'Female', value: 'F' }]} value={form.sex} onChange={set('sex')} />

          <Text style={type.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={form.age}
            onChangeText={set('age')}
            placeholder="e.g. 58"
            placeholderTextColor={colors.inkMuted}
            keyboardType="numeric"
          />

          <ChipSelect label="Blood group" options={BLOOD_GROUPS.map((g) => ({ label: g, value: g }))} value={form.bloodGroup} onChange={set('bloodGroup')} />

          <Text style={type.label}>Known conditions</Text>
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={form.conditions}
            onChangeText={set('conditions')}
            placeholder="Diabetes, hypertension, allergies…"
            placeholderTextColor={colors.inkMuted}
            multiline
          />

          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowForm(false); setForm(BLANK_FORM); }}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={save}>
              <Text style={{ color: colors.white, fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
          <Text style={styles.addButtonText}>+ Add family member</Text>
        </TouchableOpacity>
      )}

      <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl }]}>
        Saved on this device now (survives closing the app), but stays on this phone only
        — no account sync, so it won't appear on another device or survive an app
        reinstall/uninstall.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center', ...shadow.card,
  },
  memberCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card,
  },
  removeButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
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
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelButton: {
    flex: 1, borderRadius: radius.pill, paddingVertical: spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  saveButton: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.sm, alignItems: 'center', ...shadow.card,
  },
  addButton: {
    borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center',
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  addButtonText: { color: colors.primary, fontWeight: '700' },
});
