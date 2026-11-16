import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { COUNTRIES, initials } from '@/data/demo';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, CountryMark, F, Press, tap, useBottomPad } from '@/components/ui';

export default function Profile() {
  const c = useColors();
  const { profile, setProfile } = useApp();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [home, setHome] = useState(profile.homeCountry);
  const bottom = useBottomPad(false);
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const valid = name.trim().length > 1 && emailOk;
  return (
    <KeyboardAwareScrollViewCompat style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 10 }} bottomOffset={20}>
      <View style={[styles.avatar, { backgroundColor: '#D9F5E3' }]}><Text style={{ fontFamily: F.m, fontSize: 30, color: '#1F7A45' }}>{initials(name)}</Text></View>
      <Text style={[styles.label, { color: c.mutedForeground }]}>Name</Text>
      <TextInput testID="profile-name" value={name} onChangeText={setName} style={[styles.input, { backgroundColor: c.card, color: c.foreground }]} placeholderTextColor={c.mutedForeground} placeholder="Your name" />
      <Text style={[styles.label, { color: c.mutedForeground }]}>Email</Text>
      <TextInput testID="profile-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { backgroundColor: c.card, color: c.foreground }]} placeholderTextColor={c.mutedForeground} placeholder="you@example.com" />
      {!emailOk && email ? <Text style={{ fontFamily: F.r, color: c.destructive, fontSize: 13 }}>Enter a valid email address.</Text> : null}
      <Text style={[styles.label, { color: c.mutedForeground }]}>Home country</Text>
      <View style={styles.chips}>
        {COUNTRIES.map((ct) => (
          <Press key={ct.code} testID={`profile-home-${ct.code}`} haptic={false} onPress={() => { tap('select'); setHome(ct.code); }}
            style={[styles.chip, { backgroundColor: home === ct.code ? c.accent : c.card, borderColor: home === ct.code ? c.primary : 'transparent' }]}>
            <CountryMark country={ct} size={22} />
            <Text style={{ fontFamily: F.m, fontSize: 13, color: c.foreground }}>{ct.name}</Text>
          </Press>
        ))}
      </View>
      <View style={{ height: 8 }} />
      <Btn label="Save profile" testID="profile-save" disabled={!valid} onPress={() => { tap('medium'); setProfile({ ...profile, name: name.trim(), email: email.trim(), homeCountry: home }); router.back(); }} />
      <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 12, textAlign: 'center' }}>Saved on this device only. No account is created.</Text>
    </KeyboardAwareScrollViewCompat>
  );
}
const styles = StyleSheet.create({
  avatar: { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  label: { fontFamily: F.s, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 },
  input: { borderRadius: 14, paddingHorizontal: 16, height: 50, fontFamily: F.r, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
});
