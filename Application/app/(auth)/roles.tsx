import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, HardHat, Landmark, Truck, Users } from 'lucide-react-native';
import { ROLES } from '../../src/constants/roles';
import { useSessionStore } from '../../src/store/session';
import { useTheme } from '../../src/theme/ThemeContext';
import type { Role } from '../../src/types/models';

const ICONS = { dgms: Landmark, inspector: HardHat, operator: Truck, contractor: Users } as const;

export default function RoleSelection() {
  const { t } = useTheme();
  const setRole = useSessionStore((s) => s.setRole);
  function pick(id: Role) {
    setRole(id);
    router.push('/(auth)/login');
  }
  return (
    <SafeAreaView className="flex-1 px-5" style={{ backgroundColor: t.appBg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 24 }}>
        <View className="mt-6 items-center">
          <View className="flex-row items-baseline">
            <Text className="text-[40px] font-extrabold tracking-tight" style={{ color: t.navy }}>Mine</Text>
            <Text className="text-[40px] font-extrabold tracking-tight" style={{ color: t.primary }}>Netr</Text>
          </View>
          <Text className="mt-2 text-[17px] font-bold" style={{ color: t.ink }}>Login to your account</Text>
          <Text className="mt-1 text-[13px]" style={{ color: t.secondary }}>Select your role to continue</Text>
        </View>
        <View className="mt-6 gap-3">
          {ROLES.map((r) => {
            const Icon = ICONS[r.id];
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={r.title}
                onPress={() => pick(r.id)}
                className="flex-row items-center rounded-2xl p-4"
                style={{ backgroundColor: r.tint, borderWidth: 1, borderColor: t.divider }}
              >
                <View className="mr-3 h-12 w-12 items-center justify-center rounded-xl bg-white/80">
                  <Icon size={26} color={r.iconColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold" style={{ color: r.iconColor }}>{r.title}</Text>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>{r.sub}</Text>
                </View>
                <ChevronRight size={22} color={r.iconColor} />
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-6 text-center text-[11px]" style={{ color: t.secondary }}>
          Role selection only chooses the login flow. Permissions are verified at sign-in.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
