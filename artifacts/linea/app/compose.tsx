import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { CONTACTS } from '@/data/demo';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Avatar, Btn, DemoNote, F, Press, Section, tap, useBottomPad } from '@/components/ui';

export default function Compose() {
  const c = useColors();
  const { saveLocalMessage } = useApp();
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const bottom = useBottomPad(false);
  const valid = to.replace(/\D/g, '').length >= 7 && body.trim().length > 0;
  const save = () => {
    tap('medium');
    const id = saveLocalMessage(to.trim(), body.trim());
    router.replace(`/conversation/${id}`);
  };
  return (
    <KeyboardAwareScrollViewCompat style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 12 }} bottomOffset={20}>
      <DemoNote text="Twilio is not connected. Your message will be saved on this device only and will not be sent." icon="alert-circle" />
      <Text style={[styles.label, { color: c.mutedForeground }]}>To</Text>
      <TextInput testID="compose-to" value={to} onChangeText={setTo} placeholder="+44 7700 900000" placeholderTextColor={c.mutedForeground} keyboardType="phone-pad"
        style={[styles.input, { backgroundColor: c.card, color: c.foreground }]} />
      <Text style={[styles.label, { color: c.mutedForeground }]}>Message</Text>
      <TextInput testID="compose-body" value={body} onChangeText={setBody} placeholder="Write something" placeholderTextColor={c.mutedForeground} multiline
        style={[styles.input, { backgroundColor: c.card, color: c.foreground, minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }]} />
      <Btn label="Save locally" icon="save" testID="compose-save" onPress={save} disabled={!valid} />
      <View style={{ marginHorizontal: -18 }}><Section label="Demo contacts" /></View>
      {CONTACTS.map((ct) => (
        <Press key={ct.id} testID={`compose-contact-${ct.id}`} onPress={() => setTo(ct.number)} style={styles.row} scale={0.98}>
          <Avatar name={ct.name} hue={ct.hue} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 15 }}>{ct.name}</Text>
            <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 13 }}>{ct.number}</Text>
          </View>
        </Press>
      ))}
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({
  label: { fontFamily: F.s, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  input: { borderRadius: 14, paddingHorizontal: 16, height: 50, fontFamily: F.r, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
});
