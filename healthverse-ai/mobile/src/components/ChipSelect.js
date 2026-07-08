import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, type, spacing, radius } from '../theme';

// options: [{ label: 'Male', value: 'M' }, ...]
export default function ChipSelect({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[type.label, { marginBottom: spacing.xs }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(opt.value)}
            >
              <Text style={[type.body, { fontSize: 14 }, selected && { color: colors.white }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
