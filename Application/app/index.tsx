/**
 * Splash: MineNetr logo centered over the mining photo + animated loading bar.
 * Real init work (prefs + session restore) drives completion — never a bare timer.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Images } from '../src/constants/images';
import { mockRepo } from '../src/repositories/mockStore';
import { services } from '../src/services/serviceProvider';
import { useSessionStore } from '../src/store/session';

export default function Splash() {
  const [progress] = useState(() => new Animated.Value(0));
  const done = useRef(false);

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: false }).start();
    (async () => {
      try {
        await mockRepo.ready();
        const prefs = mockRepo.preferences;
        const session = await services.auth.getSession().catch(() => null);
        // Let the loading-bar animation read as intentional, not a stall.
        await new Promise((r) => setTimeout(r, 1500));
        if (done.current) return;
        done.current = true;
        useSessionStore.getState().setSession(session);
        if (session?.role === 'contractor') router.replace('/(contractor)/(tabs)');
        else if (session) router.replace('/(other-roles)/unavailable');
        else if (!prefs.onboardingDone) router.replace('/onboarding');
        else router.replace('/(auth)/roles');
      } catch {
        if (!done.current) {
          done.current = true;
          router.replace('/onboarding');
        }
      }
    })();
  }, [progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['8%', '100%'] });

  return (
    <ImageBackground source={Images.splashBg} className="flex-1" resizeMode="cover">
      <View className="flex-1 bg-[#0B3154]/35" />
      <SafeAreaView className="absolute inset-0 items-center justify-between py-16">
        <View className="items-center">
          <View className="flex-row items-baseline">
            <Text className="text-[52px] font-extrabold tracking-tight text-white">Mine</Text>
            <Text className="text-[52px] font-extrabold tracking-tight text-[#5EB2FF]">Netr</Text>
          </View>
          <Text className="mt-2 text-center text-[17px] font-medium leading-6 text-white/95">
            Smart Governance.{'\n'}Safer Mines.{'\n'}Sustainable Future.
          </Text>
        </View>
        <View className="h-1.5 w-40 overflow-hidden rounded-full bg-white/30" accessibilityLabel="Loading">
          <Animated.View className="h-full rounded-full bg-white" style={{ width }} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
