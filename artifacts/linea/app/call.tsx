import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { contactByNumber } from '@/data/demo';
import { Avatar, Btn, F, useBottomPad } from '@/components/ui';
import { getGetVoiceReadinessQueryKey, useGetVoiceReadiness } from '@workspace/api-client-react';

export default function CallScreen() {
  const c = useColors();
  const { number = '' } = useLocalSearchParams<{ number: string }>();
  const { logAttempt, threads, blocked, toggleBlocked } = useApp();
  const ct = contactByNumber(number);
  const bottom = useBottomPad(false);
  const readiness = useGetVoiceReadiness({
    query: { queryKey: getGetVoiceReadinessQueryKey(), staleTime: 15_000, retry: false },
  });
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
        <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>Call setup required</Text>
        <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
          No call has started and no credit has been charged. Expo Go cannot run Twilio calling; an installed Android build is needed.
        </Text>
        <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>
          Incoming and outgoing routing rules are prepared on the server but are not activated. Background ringing and live audio have not been tested.
        </Text>
      </View>
      <View testID="call-setup-status" style={[styles.card, { backgroundColor: c.card }]}>
        <Text style={{ fontFamily: F.s, fontSize: 17, color: c.foreground }}>What still needs setup</Text>
        {readiness.isLoading ? <ActivityIndicator color={c.primary} /> : null}
        {readiness.isError ? (
          <Text accessibilityRole="alert" style={{ fontFamily: F.r, color: c.destructive, lineHeight: 21 }}>
            Could not check the calling service. Calling remains unavailable. Try refreshing below.
          </Text>
        ) : null}
        {readiness.data?.blockers.map((blocker, index) => (
          <View key={blocker} style={styles.statusRow}>
            <Feather name="clock" size={15} color={c.mutedForeground} style={{ marginTop: 3 }} />
            <Text testID={`call-blocker-${index}`} style={{ flex: 1, fontFamily: F.r, fontSize: 13, lineHeight: 20, color: c.mutedForeground }}>
              {blocker}
            </Text>
          </View>
        ))}
        <Btn label={readiness.isFetching ? 'Checking setup…' : 'Refresh setup status'} kind="ghost"
          icon="refresh-cw" testID="call-refresh-status" disabled={readiness.isFetching}
          onPress={() => void readiness.refetch()} />
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
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 3 },
});
