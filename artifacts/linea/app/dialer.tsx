import React, { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { contactByNumber } from '@/data/demo';
import { F, Press, tap } from '@/components/ui';

const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];

export default function Dialer() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [num, setNum] = useState('');
  const match = num.length > 5 ? contactByNumber(num) : undefined;
  const press = (k: string) => { tap('select'); setNum((n) => (n + k).slice(0, 20)); };
  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 12 }}>
      <View style={styles.display}>
        <Text testID="dialer-number" numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: F.m, fontSize: 36, color: c.foreground, letterSpacing: 1 }}>{num || ' '}</Text>
        <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14, marginTop: 6 }}>{match ? match.name : num ? 'Not in demo contacts' : 'Enter a number with country code'}</Text>
      </View>
      <View style={styles.grid}>
        {KEYS.map(([k, sub]) => (
          <Press key={k} testID={`dialer-key-${k === '*' ? 'star' : k === '#' ? 'hash' : k}`} haptic={false} scale={0.9}
            onPress={() => press(k)} onLongPress={() => k === '0' && press('+')} style={[styles.key, { backgroundColor: c.card }]}>
            <Text style={{ fontFamily: F.m, fontSize: 30, color: c.foreground }}>{k}</Text>
            {sub ? <Text style={{ fontFamily: F.s, fontSize: 10, letterSpacing: 2, color: c.mutedForeground }}>{sub}</Text> : null}
          </Press>
        ))}
      </View>
      <View style={styles.actions}>
        <View style={{ width: 64 }} />
        <Press testID="dialer-call" disabled={num.length < 3} accessibilityLabel="Call" onPress={() => router.replace({ pathname: '/call', params: { number: num } })}
          style={[styles.call, { backgroundColor: c.primary, opacity: num.length < 3 ? 0.4 : 1 }]}>
          <Feather name="phone" size={28} color={c.primaryForeground} />
        </Press>
        <Press testID="dialer-delete" accessibilityLabel="Delete digit" onPress={() => setNum((n) => n.slice(0, -1))} onLongPress={() => setNum('')} style={{ width: 64, alignItems: 'center' }}>
          {num ? <Feather name="delete" size={26} color={c.mutedForeground} /> : null}
        </Press>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  display: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, paddingHorizontal: 40, maxWidth: 360, alignSelf: 'center' },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 22, paddingHorizontal: 40 },
  call: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
