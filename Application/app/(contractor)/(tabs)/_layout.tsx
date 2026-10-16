import { Tabs, router } from 'expo-router';
import { Home, Users, Mountain, ReceiptText, MoreHorizontal } from 'lucide-react-native';
import { useTheme } from '../../../src/theme/ThemeContext';
import { useSessionStore } from '../../../src/store/session';
import { useEffect } from 'react';

export default function ContractorTabs() {
  const { t } = useTheme();
  const session = useSessionStore((s) => s.session);
  useEffect(() => {
    if (!session) router.replace('/(auth)/roles');
    else if (session.role !== 'contractor') router.replace('/(other-roles)/unavailable');
  }, [session]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.secondary,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.divider, paddingBottom: 10, height: 72 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }} />
      <Tabs.Screen name="workers" options={{ title: 'Workers', tabBarIcon: ({ color, size }) => <Users size={size} color={color} /> }} />
      <Tabs.Screen name="mines" options={{ title: 'Mines', tabBarIcon: ({ color, size }) => <Mountain size={size} color={color} /> }} />
      <Tabs.Screen name="bills" options={{ title: 'Bills', tabBarIcon: ({ color, size }) => <ReceiptText size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <MoreHorizontal size={size} color={color} /> }} />
    </Tabs>
  );
}
