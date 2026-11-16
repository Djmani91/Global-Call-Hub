import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { TOPUPS } from '@/data/demo';
import { Btn, DemoNote, F, Press, tap, useBottomPad } from '@/components/ui';

export default function TopUp() {
  const c = useColors();
  const [sel, setSel] = useState('p2');
  const [explained, setExplained] = useState(false);
  const bottom = useBottomPad(false);
  const chosen = TOPUPS.find((t) => t.id === sel)!;
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: 18, paddingBottom: bottom, gap: 10 }}>
      <Text style={{ fontFamily: F.b, fontSize: 24, color: c.foreground }}>Choose an amount</Text>
      <Text style={{ fontFamily: F.r, fontSize: 14, color: c.mutedForeground, marginBottom: 6 }}>Credit never expires while your line is active.</Text>
      {TOPUPS.map((t) => {
        const on = t.id === sel;
        return (
          <Press key={t.id} testID={`topup-${t.id}`} haptic={false} onPress={() => { tap('select'); setSel(t.id); setExplained(false); }}
            style={[styles.opt, { backgroundColor: on ? c.accent : c.card, borderColor: on ? c.primary : 'transparent' }]}>
            <View style={[styles.radio, { borderColor: on ? c.primary : c.mutedForeground }]}>{on ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.b, fontSize: 20, color: c.foreground }}>£{t.amount.toFixed(2)}</Text>
              <Text style={{ fontFamily: F.r, fontSize: 13, color: c.mutedForeground }}>{t.note}</Text>
            </View>
          </Press>
        );
      })}
      {explained ? (
        <View testID="topup-blocked" style={[styles.info, { backgroundColor: c.card }]}>
          <Feather name="lock" size={18} color={c.warning} />
          <Text style={{ flex: 1, fontFamily: F.r, fontSize: 14, color: c.foreground, lineHeight: 20 }}>
            Top-ups are not available in this demo. No payment of £{chosen.amount.toFixed(2)} was taken and your balance is unchanged.
          </Text>
        </View>
      ) : null}
      <Btn label={`Continue with £${chosen.amount.toFixed(2)}`} testID="topup-continue" onPress={() => { tap('medium'); setExplained(true); }} />
      <DemoNote text="Minute estimates use sample rates, not verified pricing." />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  info: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14 },
});
