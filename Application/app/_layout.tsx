import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { useSessionStore } from '../src/store/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Boot() {
  const hydrateTheme = useSessionStore((s) => s.hydrateTheme);
  useEffect(() => {
    hydrateTheme().finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, [hydrateTheme]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={qc}>
          <ThemeProvider>
            <Boot />
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(contractor)" />
              <Stack.Screen name="(other-roles)" />
            </Stack>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
