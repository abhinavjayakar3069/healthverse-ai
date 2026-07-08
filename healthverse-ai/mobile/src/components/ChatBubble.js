import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, type, spacing, radius } from '../theme';

export default function ChatBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[type.body, isUser && { color: colors.white }]}>{content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: spacing.xs },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleAssistant: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: radius.sm },
});
