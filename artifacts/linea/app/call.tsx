import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { contactByNumber } from '@/data/demo';
import { Avatar, Btn, F, useBottomPad } from '@/components/ui';

export default function CallScreen() {
  const c = useColors();
  const { number = '' } = useLocalSearchParams<{ number: string }>();
  const { logAttempt, threads, blocked, toggleBlocked } = useApp();
  const ct = contactByNumber(number);
  const bottom = useBottomPad(false);
  const thread = threads.find((t) => t.number === number);
  const isBlocked = blocked.includes(number);
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 22, paddingBottom: bottom, gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 8, marginVertical: 12 }}>
        <Avatar name={ct?.name ?? number} hue={ct?.hue} size={84} />
        <Text style={{ fontFamily: F.b, fontSize: 24, color: c.foreground }}>{ct?.name ?? number}</Text>
        {ct ? <Text style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground }}>{number}</Text> : null}
      </View>
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <View style={[styles.icon, { backgroundColor: c.accent }]}><Feather name="phone-off" size={22} color={c.primary} /></View>
        <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>Calling unavailable in this preview</Text>
        <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
          Expo Go cannot make or receive Twilio Voice calls, including in the background. No call has started and no time is being counted.
        </Text>
        <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
          Android and iPhone calling needs a supported installed build, secure customer sign-in, assigned numbers and platform push setup. These requirements are not yet verified.
        </Text>
        <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
          Future installed-app controls will include answer, decline, hang up, mute and audio routing. Ringing, connected and ended states will come from the call service, not a demo timer.
        </Text>
      </View>
      <Btn label="Note this call for later" icon="bookmark" testID="call-log" onPress={() => { logAttempt(number); router.back(); }} />
      <Btn label={thread ? 'Open conversation' : 'Write a message'} icon="message-circle" kind="ghost" testID="call-message"
        onPress={() => router.replace(thread ? `/conversation/${thread.id}` : '/compose')} />
      <Btn label={isBlocked ? 'Unblock number' : 'Block number'} icon="slash" kind="danger" testID="call-block" onPress={() => toggleBlocked(number)} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 18, gap: 8, marginBottom: 8 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
