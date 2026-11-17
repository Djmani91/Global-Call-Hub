import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { tap } from '@/components/ui';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'phone', selected: 'phone.fill' }} />
        <NativeTabs.Trigger.Label>Calls</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} />
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="numbers">
        <NativeTabs.Trigger.Icon sf={{ default: 'simcard', selected: 'simcard.fill' }} />
        <NativeTabs.Trigger.Label>Numbers</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="credit">
        <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} />
        <NativeTabs.Trigger.Label>Credit</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const TABS: { name: string; title: string; feather: keyof typeof Feather.glyphMap; sf: string }[] = [
  { name: 'index', title: 'Calls', feather: 'phone', sf: 'phone' },
  { name: 'messages', title: 'Messages', feather: 'message-circle', sf: 'bubble.left.and.bubble.right' },
  { name: 'numbers', title: 'Numbers', feather: 'hash', sf: 'simcard' },
  { name: 'credit', title: 'Credit', feather: 'credit-card', sf: 'creditcard' },
  { name: 'settings', title: 'Settings', feather: 'settings', sf: 'gearshape' },
];

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  return (
    <Tabs
      screenListeners={{ tabPress: () => tap('select') }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} /> :
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />,
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title,
          tabBarButtonTestID: `tab-${t.title.toLowerCase()}`,
          tabBarIcon: ({ color, focused }) => isIOS
            ? <SymbolView name={(focused ? `${t.sf}.fill` : t.sf) as never} tintColor={color as string} size={24} />
            : <Feather name={t.feather} size={22} color={color as string} />,
        }} />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const colors = useColors();
  const { ready } = useApp();
  if (!isLoaded) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} color={colors.primary} />;
  if (!ready) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} color={colors.primary} />;
  if (!isSignedIn) return <Redirect href="/auth" />;
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
