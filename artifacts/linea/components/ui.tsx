import React, { useRef } from 'react';
import { Alert, Animated, Platform, Pressable, PressableProps, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Country, initials } from '@/data/demo';

export const F = { r: 'Inter_400Regular', m: 'Inter_500Medium', s: 'Inter_600SemiBold', b: 'Inter_700Bold' };

let hapticsOn = true;
export function setHapticsEnabled(v: boolean) { hapticsOn = v; }

export function confirmAction(title: string, message: string, label: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    const w = globalThis as unknown as { confirm?: (m: string) => boolean };
    if (w.confirm ? w.confirm(`${title}\n\n${message}`) : false) onConfirm();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: label, style: 'destructive', onPress: onConfirm }]);
}

export function tap(kind: 'light' | 'medium' | 'select' = 'light') {
  if (Platform.OS === 'web' || !hapticsOn) return;
  if (kind === 'select') Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

type PProps = PressableProps & { style?: StyleProp<ViewStyle>; scale?: number; haptic?: boolean; children?: React.ReactNode };
export function Press({ style, scale = 0.97, haptic = true, onPress, children, ...rest }: PProps) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (n: number) => Animated.spring(v, { toValue: n, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      {...rest}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      onPress={(e) => { if (haptic) tap(); onPress?.(e); }}
    >
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function useTopPad(extra = 8) {
  const i = useSafeAreaInsets();
  return (Platform.OS === 'web' ? 67 : i.top) + extra;
}
export function useBottomPad(tabs = true) {
  const i = useSafeAreaInsets();
  if (Platform.OS === 'web') return tabs ? 84 + 24 : 34 + 16;
  return tabs ? i.bottom + 90 : i.bottom + 16;
}

export function ScreenHeader({ title, right, left }: { title: string; right?: React.ReactNode; left?: React.ReactNode }) {
  const c = useColors();
  const top = useTopPad(6);
  return (
    <View style={[s.header, { paddingTop: top }]}>
      <View style={s.side}>{left}</View>
      <Text style={[s.title, { color: c.foreground }]} numberOfLines={1}>{title}</Text>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function IconButton({ name, onPress, testID, color, label, size = 26 }: { name: keyof typeof Feather.glyphMap; onPress: () => void; testID: string; color?: string; label: string; size?: number }) {
  const c = useColors();
  return (
    <Press onPress={onPress} testID={testID} accessibilityLabel={label} accessibilityRole="button" hitSlop={10} style={s.iconBtn}>
      <Feather name={name} size={size} color={color ?? c.primary} />
    </Press>
  );
}

export function SearchBar({ value, onChange, placeholder = 'Search', testID, right, keyboardType }: { value: string; onChange: (t: string) => void; placeholder?: string; testID: string; right?: React.ReactNode; keyboardType?: TextInputProps['keyboardType'] }) {
  const c = useColors();
  return (
    <View style={s.searchRow}>
      <View style={[s.search, { backgroundColor: c.card }]}>
        <Feather name="search" size={18} color={c.mutedForeground} />
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={c.mutedForeground}
          keyboardType={keyboardType}
          style={[s.searchInput, { color: c.foreground }]}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value ? (
          <Pressable onPress={() => onChange('')} hitSlop={10} testID={`${testID}-clear`} accessibilityLabel="Clear search">
            <Feather name="x-circle" size={17} color={c.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Avatar({ name, hue, size = 46, badge }: { name: string; hue?: string; size?: number; badge?: boolean }) {
  const c = useColors();
  const isNum = /^[+\d(]/.test(name);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: hue ?? c.elevated }]}>
        {isNum ? <Feather name="user" size={size * 0.42} color={c.mutedForeground} /> : (
          <Text style={{ fontFamily: F.m, fontSize: size * 0.38, color: '#1F5C38' }}>{initials(name)}</Text>
        )}
      </View>
      {badge ? (
        <View style={[s.badge, { backgroundColor: c.primary, borderColor: c.background }]}>
          <Feather name="hash" size={9} color={c.primaryForeground} />
        </View>
      ) : null}
    </View>
  );
}

export function CountryMark({ country, size = 34 }: { country: Country; size?: number }) {
  const h = size * 0.7;
  return (
    <View style={{ width: size, height: h, borderRadius: 5, overflow: 'hidden', flexDirection: country.vertical ? 'row' : 'column' }} accessibilityLabel={`${country.name} mark`}>
      {country.stripes.map((col, i) => <View key={i} style={{ flex: 1, backgroundColor: col }} />)}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: F.b, fontSize: size * 0.3, color: '#16171A', backgroundColor: 'rgba(244,241,234,0.82)', paddingHorizontal: 3, borderRadius: 3, overflow: 'hidden' }}>{country.code}</Text>
      </View>
    </View>
  );
}

export function Bubbles() {
  const dots = [[8, 6, 14], [22, 70, 8], [44, 18, 10], [62, 82, 12], [80, 30, 7], [90, 64, 16], [35, 88, 6], [70, 8, 9], [14, 46, 7], [52, 52, 6]];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {dots.map(([x, y, r], i) => (
        <View key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: r, height: r, borderRadius: r, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }} />
      ))}
    </View>
  );
}

export function Hero({ title, body, cta, onPress, testID }: { title: string; body: string; cta: string; onPress: () => void; testID: string }) {
  const c = useColors();
  return (
    <View style={[s.hero, { backgroundColor: c.primary }]}>
      <Bubbles />
      <Text style={[s.heroTitle, { color: c.primaryForeground }]}>{title}</Text>
      <Text style={[s.heroBody, { color: c.primaryForeground }]}>{body}</Text>
      <Press testID={testID} onPress={onPress} style={[s.heroBtn, { backgroundColor: c.ink }]} accessibilityRole="button">
        <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 16 }}>{cta}</Text>
      </Press>
    </View>
  );
}

export function DemoNote({ text, icon = 'info' }: { text: string; icon?: keyof typeof Feather.glyphMap }) {
  const c = useColors();
  return (
    <View style={[s.note, { backgroundColor: c.accent, borderColor: '#2D5A40' }]}>
      <Feather name={icon} size={15} color={c.accentForeground} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: c.accentForeground, fontFamily: F.r, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}

export function Section({ label }: { label: string }) {
  const c = useColors();
  return <Text style={[s.section, { color: c.mutedForeground }]}>{label}</Text>;
}

export function Btn({ label, onPress, testID, kind = 'primary', icon, disabled }: { label: string; onPress: () => void; testID: string; kind?: 'primary' | 'ghost' | 'danger'; icon?: keyof typeof Feather.glyphMap; disabled?: boolean }) {
  const c = useColors();
  const bg = kind === 'primary' ? c.primary : kind === 'danger' ? 'transparent' : c.card;
  const fg = kind === 'primary' ? c.primaryForeground : kind === 'danger' ? c.destructive : c.foreground;
  return (
    <Press testID={testID} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, borderColor: kind === 'danger' ? c.destructive : 'transparent' }]}>
      {icon ? <Feather name={icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: F.s, fontSize: 16, color: fg }}>{label}</Text>
    </Press>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  const c = useColors();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIcon, { backgroundColor: c.card }]}><Feather name={icon} size={26} color={c.primary} /></View>
      <Text style={{ fontFamily: F.s, color: c.foreground, fontSize: 17 }}>{title}</Text>
      <Text style={{ fontFamily: F.r, color: c.mutedForeground, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12 },
  side: { width: 64 },
  title: { flex: 1, textAlign: 'center', fontFamily: F.b, fontSize: 20 },
  iconBtn: { padding: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, marginBottom: 10 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 24, paddingHorizontal: 16, height: 46 },
  searchInput: { flex: 1, fontFamily: F.r, fontSize: 16, height: 46, outlineStyle: 'none' } as never,
  avatar: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 17, height: 17, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  hero: { marginHorizontal: 18, borderRadius: 18, padding: 24, overflow: 'hidden' },
  heroTitle: { fontFamily: F.b, fontSize: 25, letterSpacing: -0.4 },
  heroBody: { fontFamily: F.r, fontSize: 15, marginTop: 6, opacity: 0.85 },
  heroBtn: { alignSelf: 'flex-start', marginTop: 18, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  section: { fontFamily: F.s, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, paddingHorizontal: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, borderWidth: 1.5 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 40, paddingVertical: 50 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
