import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { colors, type, spacing, radius } from '../theme';

export default function LabeledInput({ label, value, onChangeText, placeholder, unit, keyboardType = 'numeric' }) {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{label}{unit ? ` (${unit})` : ''}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginTop: spacing.xs, ...type.body,
  },
});
