import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { colors, type, spacing, radius, shadow } from '../theme';
import { api } from '../api/client';
import ChatBubble from '../components/ChatBubble';

const WELCOME = {
  chat: {
    role: 'assistant',
    content: "Hi! Ask me about symptoms, conditions, or anything health-related — I'll do my best to help, though I'm not a substitute for seeing a doctor.",
  },
  symptom: {
    role: 'assistant',
    content: "Tell me what you're experiencing — how long it's been going on, and anything else you've noticed. I'll ask follow-ups if I need more detail.",
  },
};

export default function AssistantScreen({ route }) {
  const initialMode = route?.params?.mode === 'symptom' ? 'symptom' : 'chat';
  const [mode, setMode] = useState(initialMode); // 'chat' | 'symptom'
  const [chatMessages, setChatMessages] = useState([WELCOME.chat]);
  const [symptomMessages, setSymptomMessages] = useState([WELCOME.symptom]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [urgentNotice, setUrgentNotice] = useState(false);
  const listRef = useRef(null);

  const messages = mode === 'chat' ? chatMessages : symptomMessages;
  const setMessages = mode === 'chat' ? setChatMessages : setSymptomMessages;
  const apiCall = mode === 'chat' ? api.chat : api.symptomCheck;

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setUrgentNotice(false);

    try {
      // API history format needs {role, content} pairs, excluding our local welcome message
      const history = nextMessages.slice(1, -1).map(({ role, content }) => ({ role, content }));
      const result = await apiCall(text, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      if (result.flagged_urgent) setUrgentNotice(true);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "I couldn't reach the server. Check that the backend is running and API_BASE_URL is set correctly.",
      }]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'chat' && styles.toggleButtonActive]}
          onPress={() => setMode('chat')}
        >
          <Text style={[styles.toggleText, mode === 'chat' && styles.toggleTextActive]}>
            Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, mode === 'symptom' && styles.toggleButtonActive]}
          onPress={() => setMode('symptom')}
        >
          <Text style={[styles.toggleText, mode === 'symptom' && styles.toggleTextActive]}>
            Symptom checker
          </Text>
        </TouchableOpacity>
      </View>

      {urgentNotice && (
        <View style={styles.urgentBanner}>
          <Text style={[type.caption, { color: colors.white }]}>
            If this feels like an emergency, please contact local emergency services now.
          </Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[type.caption, { marginLeft: spacing.sm }]}>Thinking…</Text>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={mode === 'chat' ? "Describe how you're feeling…" : "e.g. fever and headache for 2 days"}
          placeholderTextColor={colors.inkMuted}
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={send}
        />
        <TouchableOpacity style={styles.sendButton} onPress={send} disabled={sending}>
          <Text style={{ color: colors.white, fontWeight: '600' }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toggleRow: {
    flexDirection: 'row', margin: spacing.md, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill, padding: 4,
  },
  toggleButton: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.pill },
  toggleButtonActive: { backgroundColor: colors.primary, ...shadow.card },
  toggleText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  toggleTextActive: { color: colors.white },
  list: { padding: spacing.lg, paddingTop: 0 },
  urgentBanner: { backgroundColor: colors.accentCoral, padding: spacing.sm, alignItems: 'center' },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, maxHeight: 100, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginRight: spacing.sm, ...type.body,
  },
  sendButton: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, ...shadow.card,
  },
});
