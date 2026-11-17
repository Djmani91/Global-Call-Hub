import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppProvider } from '@/context/AppContext';
import { BillingProvider } from '@/context/BillingContext';
import colors from '@/constants/colors';
import { setBaseUrl } from '@workspace/api-client-react';

SplashScreen.preventAutoHideAsync();
if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}
const queryClient = new QueryClient();
const c = colors.light;

const close = () => (
  <Pressable onPress={() => router.back()} hitSlop={12} testID="modal-close" accessibilityLabel="Close">
    <Feather name="x" size={24} color={c.foreground} />
  </Pressable>
);

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="conversation/[id]" options={{ title: '' }} />
      <Stack.Screen name="compose" options={{ title: 'New message', presentation: 'modal', headerLeft: close }} />
      <Stack.Screen name="dialer" options={{ title: 'Keypad', presentation: 'modal', headerLeft: close }} />
      <Stack.Screen name="call" options={{ title: 'Call', presentation: 'modal', headerLeft: close }} />
      <Stack.Screen name="countries" options={{ title: 'Select country', presentation: 'modal', headerLeft: close }} />
      <Stack.Screen name="numbers/[country]" options={{ title: 'Sample numbers' }} />
      <Stack.Screen name="numbers/plan" options={{ title: 'Get your Number' }} />
      <Stack.Screen name="number/[id]" options={{ title: 'Number details' }} />
      <Stack.Screen name="topup" options={{ title: 'Top up', presentation: 'modal', headerLeft: close }} />
      <Stack.Screen name="profile" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="settings/[section]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <BillingProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
              <KeyboardProvider>
                <StatusBar style="light" />
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
            </BillingProvider>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
