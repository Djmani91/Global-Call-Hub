import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { initials } from '@/data/demo';
import { F, Press, ScreenHeader, useBottomPad } from '@/components/ui';

const ITEMS: { key: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'blocked', label: 'Blocked numbers', icon: 'slash' },
  { key: 'contacts', label: 'Contacts', icon: 'book-open' },
  { key: 'appearance', label: 'Appearance', icon: 'droplet' },
  { key: 'rates', label: 'Rates', icon: 'refresh-cw' },
  { key: 'billing', label: 'Billing', icon: 'credit-card' },
  { key: 'privacy', label: 'Privacy & data', icon: 'shield' },
  { key: 'support', label: 'Help & support', icon: 'life-buoy' },
  { key: 'about', label: 'About this demo', icon: 'info' },
];

export default function Settings() {
  const c = useColors();
  const { profile } = useApp();
  const bottom = useBottomPad();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: bottom }}>
        <Press testID="settings-profile" onPress={() => router.push('/profile')} style={styles.profile} scale={0.98}>
          <View style={[styles.avatar, { backgroundColor: '#D9F5E3' }]}>
            <Text style={{ fontFamily: F.m, fontSize: 34, color: '#1F7A45' }}>{initials(profile.name)}</Text>
          </View>
          <Text style={{ fontFamily: F.b, fontSize: 22, color: c.foreground, marginTop: 12 }}>{profile.name}</Text>
          <Text style={{ fontFamily: F.r, fontSize: 15, color: c.mutedForeground, marginTop: 2 }}>{profile.email}</Text>
          <View style={[styles.pill, { backgroundColor: c.card }]}>
            <Feather name="edit-2" size={13} color={c.primary} />
            <Text style={{ fontFamily: F.m, fontSize: 13, color: c.primary }}>Edit profile</Text>
          </View>
        </Press>
        <View style={[styles.group, { backgroundColor: c.card }]}>
          {ITEMS.map((it, i) => (
            <Press key={it.key} testID={`settings-${it.key}`} onPress={() => router.push(`/settings/${it.key}`)} scale={0.99}
              style={[styles.item, i < ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
              <Feather name={it.icon} size={21} color={c.mutedForeground} />
              <Text style={{ flex: 1, fontFamily: F.r, fontSize: 16, color: c.foreground }}>{it.label}</Text>
              <Feather name="chevron-right" size={20} color={c.mutedForeground} />
            </Press>
          ))}
        </View>
        <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground, padding: 18 }}>Linea 0.1 · Demo build · Data stored on this device only</Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  profile: { alignItems: 'center', paddingVertical: 14 },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  group: { marginHorizontal: 18, marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 15 },
});
