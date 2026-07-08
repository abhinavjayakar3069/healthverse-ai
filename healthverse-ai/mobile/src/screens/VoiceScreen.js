import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { colors, type, spacing, radius, shadow } from '../theme';
import { api } from '../api/client';
import ChatBubble from '../components/ChatBubble';
import ChipSelect from '../components/ChipSelect';

// expo-speech uses BCP-47-ish locale codes for voice selection. Quality and
// availability depend entirely on voices installed on the device's OS -
// not something I can verify without a real phone. Whisper (transcription)
// auto-detects the spoken language and generally handles Hindi well; other
// Indian regional languages are more variable - test with your actual
// target languages before relying on this.
const LANGUAGES = [
  { label: 'English', value: 'en-IN' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'Tamil', value: 'ta-IN' },
  { label: 'Telugu', value: 'te-IN' },
];

const WELCOME = {
  role: 'assistant',
  content: "Tap the microphone and speak — I'll transcribe what you say, reply, and read the answer back to you.",
};

export default function VoiceScreen() {
  const [messages, setMessages] = useState([WELCOME]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [language, setLanguage] = useState('en-IN');
  const recordingRef = useRef(null);
  const listRef = useRef(null);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission needed', 'Enable microphone access to use voice input.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = rec;
      setRecording(true);
    } catch (e) {
      Alert.alert('Could not start recording', String(e?.message ?? e));
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    setProcessing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      const { text } = await api.transcribeAudio(uri);
      if (!text?.trim()) {
        setProcessing(false);
        return;
      }
      const userMsg = { role: 'user', content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);

      const history = nextMessages.slice(1, -1).map(({ role, content }) => ({ role, content }));
      const result = await api.chat(text, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      Speech.speak(result.reply, { language });
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Something went wrong reaching the server or transcribing — check the backend is running and your OpenAI key is set.",
      }]);
    } finally {
      setProcessing(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={type.label}>VOICE ASSISTANT</Text>
        <ChipSelect
          label="Reply language"
          options={LANGUAGES}
          value={language}
          onChange={setLanguage}
        />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.micArea}>
        {processing ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.micButton, recording && styles.micButtonActive]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Text style={styles.micButtonText}>{recording ? 'Stop' : 'Speak'}</Text>
          </TouchableOpacity>
        )}
        <Text style={[type.caption, { marginTop: spacing.sm }]}>
          {recording ? 'Listening… tap to stop' : processing ? 'Processing…' : 'Tap to speak'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: 0 },
  list: { padding: spacing.lg },
  micArea: { alignItems: 'center', paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  micButton: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  micButtonActive: { backgroundColor: colors.accentCoral },
  micButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
