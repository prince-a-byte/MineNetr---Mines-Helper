import { ImageBackground, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, ShieldCheck, BarChart3, Users, Leaf } from 'lucide-react-native';
import { Images } from '../src/constants/images';
import { mockRepo } from '../src/repositories/mockStore';
import { useTheme } from '../src/theme/ThemeContext';

const PERKS = [
  { icon: ShieldCheck, title: 'Ensure Safety', sub: 'Stronger safety and regulatory compliance' },
  { icon: BarChart3, title: 'Real-time Monitoring', sub: 'Track operations, inspections and compliance status' },
  { icon: Users, title: 'Better Collaboration', sub: 'Connect DGMS, operators, contractors and inspectors' },
  { icon: Leaf, title: 'Sustainable Mining', sub: 'Towards a safer and greener future' },
];

export default function Onboarding() {
  const { t } = useTheme();
  async function done(skip = false) {
    void skip;
    await mockRepo.ready();
    await mockRepo.setPrefs({ onboardingDone: true });
    router.replace('/(auth)/roles');
  }
  return (
    <ImageBackground source={Images.splashBg} className="flex-1" resizeMode="cover">
      <View className="flex-1" style={{ backgroundColor: 'rgba(244,247,251,0.88)' }} />
      <SafeAreaView className="absolute inset-0 px-5 py-4">
        <View className="flex-row justify-end">
          <Link href="/(auth)/roles" asChild>
            <Pressable onPress={() => done(true)}>
              <Text className="text-[14px] font-bold" style={{ color: t.primary }}>Skip →</Text>
            </Pressable>
          </Link>
        </View>
        <View className="mt-2 items-center">
          <View className="flex-row items-baseline">
            <Text className="text-[44px] font-extrabold tracking-tight" style={{ color: t.navy }}>Mine</Text>
            <Text className="text-[44px] font-extrabold tracking-tight" style={{ color: t.primary }}>Netr</Text>
          </View>
          <Text className="mt-2 text-center text-[19px] font-extrabold leading-6" style={{ color: t.ink }}>
            One Platform for Safer{'\n'}and Compliant Mines
          </Text>
          <Text className="mt-2 px-6 text-center text-[13px] leading-5" style={{ color: t.secondary }}>
            AI-powered monitoring and compliance system connecting all stakeholders in the mining ecosystem.
          </Text>
        </View>
        <View className="mt-4 gap-2.5">
          {PERKS.map((p) => (
            <View key={p.title} className="flex-row items-center rounded-2xl p-3" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: t.lightBlue }}>
                <p.icon size={22} color={p.title === 'Ensure Safety' ? t.primary : p.title === 'Real-time Monitoring' ? t.primary : p.title === 'Better Collaboration' ? t.primary : t.success} />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold" style={{ color: t.ink }}>{p.title}</Text>
                <Text className="text-[12px]" style={{ color: t.secondary }}>{p.sub}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="mt-auto flex-row items-center justify-center gap-1.5 py-3">
          <View className="h-2 w-6 rounded-full" style={{ backgroundColor: t.primary }} />
          <View className="h-2 w-2 rounded-full bg-slate-300" />
          <View className="h-2 w-2 rounded-full bg-slate-300" />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => done()}
          className="flex-row items-center justify-center rounded-2xl py-4"
          style={{ backgroundColor: t.navy }}
        >
          <Text className="mr-2 text-[15px] font-bold text-white">Get Started</Text>
          <ArrowRight size={18} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </ImageBackground>
  );
}
