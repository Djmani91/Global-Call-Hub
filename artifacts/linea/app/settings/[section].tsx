import React from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp, Prefs } from '@/context/AppContext';
import { CONTACTS } from '@/data/demo';
import { BillingCountry, PricingDetails } from '@/components/Pricing';
import { Avatar, Btn, CountryMark, DemoNote, EmptyState, F, Press, confirmAction, tap, useBottomPad } from '@/components/ui';

const TITLES: Record<string, string> = {
  notifications: 'Notifications', blocked: 'Blocked numbers', contacts: 'Contacts', appearance: 'Appearance',
  rates: 'Rates', billing: 'Billing', privacy: 'Privacy & data', support: 'Help & support', about: 'About this demo',
};

function Toggle({ k, label, hint }: { k: keyof Prefs; label: string; hint: string }) {
  const c = useColors();
  const { prefs, setPref } = useApp();
  return (
    <View style={[styles.toggle, { borderBottomColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.m, fontSize: 16, color: c.foreground }}>{label}</Text>
        <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground, marginTop: 2 }}>{hint}</Text>
      </View>
      <Switch testID={`pref-${k}`} value={prefs[k]} onValueChange={(v) => { tap('select'); setPref(k, v); }}
        trackColor={{ true: c.primary, false: c.elevated }} thumbColor={c.foreground} />
    </View>
  );
}

export default function SettingsSection() {
  const c = useColors();
  const { section = '', country } = useLocalSearchParams<{ section: string; country?: string }>();
  const { blocked, toggleBlocked, resetDemo, profile } = useApp();
  const bottom = useBottomPad(false);
  const card = [styles.card, { backgroundColor: c.card }];
  const P = (t: string) => <Text style={{ fontFamily: F.r, fontSize: 14, lineHeight: 21, color: c.mutedForeground }}>{t}</Text>;

  let body: React.ReactNode;
  switch (section) {
    case 'notifications':
      body = <View style={card}>
        <Toggle k="notifyMessages" label="Message alerts" hint="Future preference: saved now, applies once messaging is live." />
        <Toggle k="notifyCalls" label="Missed call alerts" hint="Future preference: saved now, applies once calling is live." />
        <Toggle k="haptics" label="Haptic feedback" hint="Gentle taps on key actions. Applies immediately." />
      </View>;
      break;
    case 'appearance':
      body = <><View style={card}>
        <Toggle k="compact" label="Compact lists" hint="Tighter rows in Calls and Messages." />
        <Toggle k="showSeconds" label="Show exact times" hint="Exact date and time with seconds instead of relative times." />
      </View><DemoNote text="Linea uses its charcoal theme everywhere for now." /></>;
      break;
    case 'blocked':
      body = blocked.length === 0
        ? <EmptyState icon="slash" title="No blocked numbers" body="Block a number from its call details. The list stays on this device." />
        : <View style={card}>{blocked.map((n) => (
          <View key={n} style={styles.line}>
            <Text style={{ flex: 1, fontFamily: F.m, color: c.foreground, fontSize: 15 }}>{n}</Text>
            <Press testID={`unblock-${n}`} onPress={() => toggleBlocked(n)}><Text style={{ fontFamily: F.s, color: c.primary }}>Unblock</Text></Press>
          </View>))}</View>;
      break;
    case 'contacts':
      body = <><DemoNote text="Fictional demo contacts. Linea does not read your device address book." />
        <View style={card}>{CONTACTS.map((ct) => (
          <Press key={ct.id} testID={`contact-${ct.id}`} onPress={() => router.push({ pathname: '/call', params: { number: ct.number } })} style={styles.line}>
            <Avatar name={ct.name} hue={ct.hue} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 15 }}>{ct.name}</Text>
              <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 13 }}>{ct.number}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={c.mutedForeground} />
          </Press>))}</View></>;
      break;
    case 'rates':
      body = <PricingDetails initialCountry={country} />;
      break;
    case 'billing':
      body = <BillingCountry />;
      break;
    case 'privacy':
      body = <><View style={card}>{P(`Your profile (${profile.email}), drafts, shortlists and preferences are stored on this device. Number searches and destination/billing country codes are sent to our server to retrieve availability and prices.`)}</View>
        <Btn label="Reset demo data" kind="danger" icon="rotate-ccw" testID="privacy-reset" onPress={() => confirmAction('Reset demo data?', 'Profile, saved messages and preferences return to defaults.', 'Reset', () => { tap('medium'); resetDemo(); router.back(); })} /></>;
      break;
    case 'support':
      body = <><View style={card}>
        {[['Why can I not place calls?', 'Calls route through Twilio, which is not connected in this build.'],
          ['Are the numbers real?', 'They are samples to preview the flow. Real stock appears once Twilio is linked.'],
          ['Where are my messages?', 'Messages you write are saved locally and never sent.']].map(([q, a]) => (
          <View key={q} style={{ paddingVertical: 10 }}>
            <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 15, marginBottom: 4 }}>{q}</Text>{P(a)}
          </View>))}
      </View>
        <Btn label="Twilio regulatory guidelines" kind="ghost" icon="external-link" testID="support-twilio" onPress={() => Linking.openURL('https://www.twilio.com/en-us/guidelines/regulatory')} /></>;
      break;
    case 'about':
      body = <View style={card}>{P('Linea is a personal second phone line for keeping in touch across borders. This is a demo build: calls, messages, number purchases and top-ups are not live. All names and numbers shown are fictional.')}</View>;
      break;
    default:
      body = <EmptyState icon="help-circle" title="Section not found" body="Head back to Settings." />;
  }
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 12 }}>
      <Stack.Screen options={{ title: TITLES[section] ?? 'Settings' }} />
      {body}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  th: { fontFamily: F.s, fontSize: 12, width: 64, textAlign: 'right' },
  td: { fontFamily: F.m, fontSize: 14, width: 64, textAlign: 'right' },
});
