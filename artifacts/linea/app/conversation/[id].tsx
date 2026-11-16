import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { contactByNumber, Message } from '@/data/demo';
import { EmptyState, F, IconButton, Press, confirmAction, tap } from '@/components/ui';

export default function Conversation() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { prefs, threads, saveLocalMessage, setDraft, markRead, deleteThread } = useApp();
  const thread = threads.find((t) => t.id === id);
  const [text, setText] = useState(thread?.draft ?? '');
  const insets = useSafeAreaInsets();
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDraftRef = useRef(setDraft);
  setDraftRef.current = setDraft;
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;

  useEffect(() => { if (id) markReadRef.current(id); }, [id]);
  const onChange = (t: string) => {
    setText(t);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { if (id) setDraftRef.current(id, t); }, 500);
  };

  if (!thread) {
    return <View style={{ flex: 1, backgroundColor: c.background }}><EmptyState icon="message-square" title="Conversation not found" body="It may have been deleted from this device." /></View>;
  }
  const name = contactByNumber(thread.number)?.name ?? thread.number;
  const save = () => {
    const t = text.trim();
    if (!t) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    tap('medium');
    saveLocalMessage(thread.number, t);
    setText('');
  };
  const data = [...thread.messages].reverse();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{
        title: name,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <IconButton name="phone" label="Call" testID="conv-call" size={21} onPress={() => router.push({ pathname: '/call', params: { number: thread.number } })} />
            <IconButton name="trash-2" label="Delete conversation" testID="conv-delete" size={21} color={c.mutedForeground} onPress={() => confirmAction('Delete conversation?', 'This removes it and any locally saved messages from this device.', 'Delete', () => { deleteThread(thread.id); router.back(); })} />
          </View>
        ),
      }} />
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0} style={{ flex: 1 }}>
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => m.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListFooterComponent={<Text style={[styles.sub, { color: c.mutedForeground }]}>{thread.number}{'\n'}Messages you write are saved locally and not sent.</Text>}
          renderItem={({ item }) => <Bubble m={item} exact={prefs.showSeconds} />}
        />
        <View style={[styles.bar, { borderTopColor: c.border, paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 10) }]}>
          <TextInput
            testID="conv-input"
            value={text}
            onChangeText={onChange}
            placeholder="Write a message (saved locally)"
            placeholderTextColor={c.mutedForeground}
            multiline
            style={[styles.input, { backgroundColor: c.card, color: c.foreground }]}
          />
          <Press testID="conv-save" onPress={save} disabled={!text.trim()} haptic={false} accessibilityLabel="Save message locally"
            style={[styles.send, { backgroundColor: text.trim() ? c.primary : c.card }]}>
            <Feather name="arrow-up" size={20} color={text.trim() ? c.primaryForeground : c.mutedForeground} />
          </Press>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ m, exact }: { m: Message; exact: boolean }) {
  const c = useColors();
  const me = m.from === 'me';
  const time = new Date(m.at).toLocaleTimeString([], exact ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={{ alignItems: me ? 'flex-end' : 'flex-start' }}>
      <View style={[styles.bubble, me ? { backgroundColor: c.accent, borderColor: '#2D5A40', borderWidth: 1, borderBottomRightRadius: 4 } : { backgroundColor: c.card, borderBottomLeftRadius: 4 }]}>
        <Text style={{ fontFamily: F.r, fontSize: 15, lineHeight: 21, color: c.foreground }}>{m.text}</Text>
      </View>
      <Text style={{ fontFamily: F.r, fontSize: 11, color: me ? c.warning : c.mutedForeground, marginTop: 3 }}>
        {me ? `Saved locally · not sent · ${time}` : time}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  sub: { fontFamily: F.r, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: F.r, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
