import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Construction } from 'lucide-react-native';
import { useSessionStore } from '../../src/store/session';
import { useTheme } from '../../src/theme/ThemeContext';
import { Button } from '../../src/components/ui/Button';

/** Placeholder boundary: other roles never land inside the contractor workspace. */
export default function Unavailable() {
  const { t } = useTheme();
  const role = useSessionStore((s) => s.selectedRole);
  return (
    <SafeAreaView className="flex-1 items-center justify-center px-8" style={{ backgroundColor: t.appBg }}>
      <Construction size={56} color={t.secondary} />
      <Text className="mt-4 text-center text-[20px] font-extrabold" style={{ color: t.ink }}>
        {role === 'contractor' ? 'Contractor' : role === 'dgms' ? 'DGMS / Main Admin' : role === 'inspector' ? 'Inspector' : 'Mine Operator'} workspace
      </Text>
      <Text className="mt-2 text-center text-[14px] leading-5" style={{ color: t.secondary }}>
        This role workspace is not yet implemented in the mobile app. The contractor experience is fully available — switch roles to continue.
      </Text>
      <View className="mt-6 w-full gap-2">
        <Button title="Continue as Contractor" onPress={() => { useSessionStore.getState().setRole('contractor'); router.replace('/(auth)/login'); }} />
        <Pressable onPress={() => router.replace('/(auth)/roles')} className="items-center py-2">
          <Text className="text-[14px] font-bold" style={{ color: t.primary }}>Choose a different role</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
