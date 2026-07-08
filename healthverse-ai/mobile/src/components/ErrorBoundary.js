import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';

// Wraps a single screen so a crash there shows a friendly fallback with a
// way back, instead of a white screen taking down the entire app. Given
// no device testing has happened yet, this is real insurance: it turns
// "the app is unusable" into "one screen has a problem, everything else
// still works" - a materially different failure mode.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`Error in ${this.props.screenName ?? 'a screen'}:`, error, info?.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={type.h1}>Something went wrong</Text>
          <Text style={[type.body, styles.message]}>
            {this.props.screenName ? `The ${this.props.screenName} screen hit a problem.` : 'This screen hit a problem.'}
            {' '}Other tabs should still work fine.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.debugText}>{String(this.state.error.message ?? this.state.error)}</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background, alignItems: 'center',
    justifyContent: 'center', padding: spacing.xl,
  },
  emoji: { fontSize: 40, marginBottom: spacing.md },
  message: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
  debugText: {
    fontSize: 12, color: colors.accentCoral, textAlign: 'center',
    marginBottom: spacing.lg, fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl, ...shadow.card,
  },
  buttonText: { color: colors.white, fontWeight: '700' },
});
