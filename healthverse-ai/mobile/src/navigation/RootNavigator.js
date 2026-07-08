import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import ErrorBoundary from '../components/ErrorBoundary';

import HomeScreen from '../screens/HomeScreen';
import AssistantScreen from '../screens/AssistantScreen';
import RiskCheckScreen from '../screens/RiskCheckScreen';
import RiskResultScreen from '../screens/RiskResultScreen';
import MoreScreen from '../screens/MoreScreen';
import EmergencySOSScreen from '../screens/EmergencySOSScreen';
import NutritionScreen from '../screens/NutritionScreen';
import MentalHealthScreen from '../screens/MentalHealthScreen';
import FamilyScreen from '../screens/FamilyScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import OutbreakScreen from '../screens/OutbreakScreen';
import MedicineReminderScreen from '../screens/MedicineReminderScreen';
import VoiceScreen from '../screens/VoiceScreen';
import FitnessScreen from '../screens/FitnessScreen';
import DoctorReportScreen from '../screens/DoctorReportScreen';

const Tab = createBottomTabNavigator();
const RiskStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();

// Simple emoji tab icons for now - swap for @expo/vector-icons whenever
// there's time to polish; kept dependency-free so this can't break the demo.
function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

// Wraps each screen in its own ErrorBoundary so a crash on one screen
// can't take down the whole app - the user can still switch tabs or go
// back. Computed once at module load (not inside a render function) so
// React Navigation always sees the same component identity across
// re-renders, rather than a new wrapper type every time.
function withBoundary(Component, screenName) {
  return function Boundary(props) {
    return (
      <ErrorBoundary screenName={screenName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

const SafeHome = withBoundary(HomeScreen, 'Home');
const SafeAssistant = withBoundary(AssistantScreen, 'Assistant');
const SafeRiskCheck = withBoundary(RiskCheckScreen, 'Risk Check');
const SafeRiskResult = withBoundary(RiskResultScreen, 'Risk Result');
const SafeMore = withBoundary(MoreScreen, 'More');
const SafeSOS = withBoundary(EmergencySOSScreen, 'Emergency SOS');
const SafeNutrition = withBoundary(NutritionScreen, 'Nutrition');
const SafeMentalHealth = withBoundary(MentalHealthScreen, 'Mental Health');
const SafeFamily = withBoundary(FamilyScreen, 'Family Health');
const SafeAnalytics = withBoundary(AnalyticsScreen, 'Health Analytics');
const SafeOutbreak = withBoundary(OutbreakScreen, 'Disease Outbreak Map');
const SafeMedicineReminder = withBoundary(MedicineReminderScreen, 'Smart Medicine');
const SafeVoice = withBoundary(VoiceScreen, 'Voice Assistant');
const SafeFitness = withBoundary(FitnessScreen, 'Fitness');
const SafeDoctorReport = withBoundary(DoctorReportScreen, 'Doctor Report');

function RiskFlow() {
  return (
    <RiskStack.Navigator screenOptions={{ headerShown: false }}>
      <RiskStack.Screen name="RiskCheck" component={SafeRiskCheck} />
      <RiskStack.Screen name="RiskResult" component={SafeRiskResult} />
    </RiskStack.Navigator>
  );
}

function MoreFlow() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHub" component={SafeMore} />
      <MoreStack.Screen name="SOS" component={SafeSOS} />
      <MoreStack.Screen name="Nutrition" component={SafeNutrition} />
      <MoreStack.Screen name="MentalHealth" component={SafeMentalHealth} />
      <MoreStack.Screen name="Family" component={SafeFamily} />
      <MoreStack.Screen name="Analytics" component={SafeAnalytics} />
      <MoreStack.Screen name="Outbreak" component={SafeOutbreak} />
      <MoreStack.Screen name="MedicineReminder" component={SafeMedicineReminder} />
      <MoreStack.Screen name="Voice" component={SafeVoice} />
      <MoreStack.Screen name="Fitness" component={SafeFitness} />
      <MoreStack.Screen name="DoctorReport" component={SafeDoctorReport} />
    </MoreStack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
      >
        <Tab.Screen
          name="Home"
          component={SafeHome}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
        />
        <Tab.Screen
          name="Assistant"
          component={SafeAssistant}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }}
        />
        <Tab.Screen
          name="Risk Check"
          component={RiskFlow}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🩺" focused={focused} /> }}
        />
        <Tab.Screen
          name="More"
          component={MoreFlow}
          options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="⋯" focused={focused} /> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
