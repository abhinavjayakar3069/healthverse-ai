import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext = createContext(null);

const DEFAULT_LIFESTYLE = {
  sleepHours: 7,
  sleepQuality: 3,     // 1-5
  stressLevel: 5,      // 1-10
  activeMinutes: 100,  // per week
  fruitVeg: 3,         // servings/day
};

const DEFAULT_EMERGENCY = {
  bloodGroup: '',
  contactName: '',
  contactPhone: '',
  medicalNotes: '',
};

const DEFAULT_PROFILE = { age: null, sex: null, weightKg: null, heightCm: null };

// On-device only (AsyncStorage) - deliberately not a backend/server sync.
// The actual problem being solved is "state resets when the app restarts,"
// not "state should appear on a different phone" - this is the smaller,
// lower-risk fix for the smaller, actual problem.
const STORAGE_PREFIX = 'healthverse:';
const PERSISTED_KEYS = ['profile', 'lifestyle', 'emergency', 'familyMembers', 'scoreHistory', 'moodCheckins'];

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [lifestyle, setLifestyle] = useState(DEFAULT_LIFESTYLE);
  const [riskResults, setRiskResults] = useState({
    diabetes: null, heart: null, hypertension: null, stroke: null, kidney: null, liver: null,
  });
  const [emergency, setEmergency] = useState(DEFAULT_EMERGENCY);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [moodCheckins, setMoodCheckins] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted state once on mount. Guards every parse so one corrupt
  // key can't crash the whole app - falls back to defaults for that key.
  useEffect(() => {
    (async () => {
      const setters = {
        profile: setProfile, lifestyle: setLifestyle, emergency: setEmergency,
        familyMembers: setFamilyMembers, scoreHistory: setScoreHistory,
        moodCheckins: setMoodCheckins,
      };
      try {
        const pairs = await AsyncStorage.multiGet(PERSISTED_KEYS.map((k) => STORAGE_PREFIX + k));
        for (const [fullKey, value] of pairs) {
          if (!value) continue;
          const key = fullKey.replace(STORAGE_PREFIX, '');
          try {
            setters[key]?.(JSON.parse(value));
          } catch (e) {
            // This one key is corrupt - skip it, keep the default, don't
            // let it take down the other four.
          }
        }
      } catch (e) {
        // AsyncStorage itself unavailable - app still works, just without
        // persistence this session.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Save on change, but only after the initial load completes - otherwise
  // the mount-time default values would write over real persisted data
  // before it's had a chance to load (verified this exact race condition
  // in isolation before writing it here - see conversation).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_PREFIX + 'profile', JSON.stringify(profile)).catch(() => {});
  }, [profile, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_PREFIX + 'lifestyle', JSON.stringify(lifestyle)).catch(() => {});
  }, [lifestyle, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_PREFIX + 'emergency', JSON.stringify(emergency)).catch(() => {});
  }, [emergency, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_PREFIX + 'familyMembers', JSON.stringify(familyMembers)).catch(() => {});
  }, [familyMembers, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_PREFIX + 'scoreHistory', JSON.stringify(scoreHistory)).catch(() => {});
  }, [scoreHistory, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_PREFIX + 'moodCheckins', JSON.stringify(moodCheckins)).catch(() => {});
  }, [moodCheckins, hydrated]);

  const updateRisk = (key, result) =>
    setRiskResults((prev) => ({ ...prev, [key]: result }));

  // Date.now()+random rather than an incrementing counter - a module-level
  // counter can reset during Expo's hot-reload in development and collide
  // with existing member IDs already in state.
  const addFamilyMember = (member) =>
    setFamilyMembers((prev) => [...prev, { ...member, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }]);

  const updateFamilyMember = (id, updates) =>
    setFamilyMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));

  const removeFamilyMember = (id) =>
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));

  const addScoreSnapshot = (entry) =>
    setScoreHistory((prev) => [...prev, { ...entry, at: Date.now() }].slice(-30));

  const addMoodCheckin = (mood) =>
    setMoodCheckins((prev) => [{ mood, at: Date.now() }, ...prev].slice(0, 20));

  return (
    <AppContext.Provider
      value={{
        profile, setProfile,
        lifestyle, setLifestyle,
        riskResults, updateRisk,
        emergency, setEmergency,
        familyMembers, addFamilyMember, updateFamilyMember, removeFamilyMember,
        scoreHistory, addScoreSnapshot,
        moodCheckins, addMoodCheckin,
        hydrated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
