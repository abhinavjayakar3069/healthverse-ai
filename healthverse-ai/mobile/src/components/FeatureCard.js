import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';

export default function FeatureCard({ icon, title, subtitle, available, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!available}
      activeOpacity={available ? 0.7 : 1}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={type.h2}>{title}</Text>
        <Text style={[type.caption, { marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <View style={[styles.badge, available ? styles.badgeOn : styles.badgeOff]}>
        <Text style={[type.caption, { fontWeight: '700', color: available ? colors.primary : colors.inkMuted }]}>
          {available ? 'Open' : 'Coming soon'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadow.card,
  },
  icon: { fontSize: 26 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeOn: { backgroundColor: colors.primarySoft },
  badgeOff: { backgroundColor: colors.surfaceAlt },
});
