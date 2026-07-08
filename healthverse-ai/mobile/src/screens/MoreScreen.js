import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, type, spacing } from '../theme';
import FeatureCard from '../components/FeatureCard';

// Matches every feature from the original pitch. `available` only ever
// reflects what's genuinely built and working right now - nothing here
// is a placeholder pretending to be finished. See AUDIT.md for why each
// "coming soon" one isn't built yet (either needs more build time, or -
// for a few - a real data source doesn't exist).
export default function MoreScreen({ navigation }) {
  const features = [
    { icon: '🧠', title: 'AI Health Assistant', subtitle: 'Chat about symptoms and conditions', available: true, onPress: () => navigation.navigate('Assistant') },
    { icon: '❤️', title: 'Disease prediction', subtitle: 'Diabetes, heart, hypertension, stroke', available: true, onPress: () => navigation.navigate('Risk Check') },
    { icon: '🧬', title: 'Health score', subtitle: 'Your daily 0-100 breakdown', available: true, onPress: () => navigation.navigate('Home') },
    { icon: '😷', title: 'Symptom checker', subtitle: 'Guided follow-up questions', available: true, onPress: () => navigation.navigate('Assistant') },
    { icon: '🚨', title: 'Emergency SOS', subtitle: 'Share location + medical info fast', available: true, onPress: () => navigation.navigate('SOS') },
    { icon: '💊', title: 'Smart medicine assistant', subtitle: 'Reminders + prescription scan + interaction check (real)', available: true, onPress: () => navigation.navigate('MedicineReminder') },
    { icon: '😊', title: 'Mental health AI', subtitle: 'Mood tracking, breathing exercises', available: true, onPress: () => navigation.navigate('MentalHealth') },
    { icon: '🍎', title: 'AI nutrition', subtitle: 'Photo-based calorie estimates', available: true, onPress: () => navigation.navigate('Nutrition') },
    { icon: '🏃', title: 'Fitness AI', subtitle: 'Steps + workout plans (real) - wearable sync not included', available: true, onPress: () => navigation.navigate('Fitness') },
    { icon: '👨‍⚕️', title: 'Doctor dashboard', subtitle: 'Shareable report (real) - live chat/video not included', available: true, onPress: () => navigation.navigate('DoctorReport') },
    { icon: '📈', title: 'Health analytics', subtitle: 'Trends over time', available: true, onPress: () => navigation.navigate('Analytics') },
    { icon: '🧬', title: 'Family health', subtitle: 'Manage multiple members', available: true, onPress: () => navigation.navigate('Family') },
    { icon: '🌍', title: 'Disease outbreak map', subtitle: 'Air quality (live) - outbreak alerts unavailable', available: true, onPress: () => navigation.navigate('Outbreak') },
    { icon: '🤖', title: 'Voice assistant', subtitle: 'Speak your symptoms', available: true, onPress: () => navigation.navigate('Voice') },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={type.label}>ALL FEATURES</Text>
      <Text style={type.display}>Explore HealthVerse</Text>
      <Text style={[type.body, { color: colors.inkMuted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Everything from the original plan, honestly labeled — open the ones that work,
        the rest are on the way.
      </Text>

      {features.map((f) => (
        <FeatureCard key={f.title} {...f} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
