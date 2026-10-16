import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { timeAgo } from '../../src/utils/format';
import { services } from '../../src/services/serviceProvider';
import { useNotifications } from '../../src/hooks/queries';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/ui/dialogs';
import { Avatar, EmptyState } from '../../src/components/ui/states';
import { Button } from '../../src/components/ui/Button';

export default function Notifications() {
  const { t } = useTheme();
  const query = useNotifications();

  async function markAll() {
    await services.notifications.markAllRead();
    query.refetch();
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
        <View className="flex-row items-center justify-between">
          <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>Notifications</Text>
          <Pressable onPress={markAll}><Text className="text-[13px] font-bold" style={{ color: t.primary }}>Mark all read</Text></Pressable>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
      >
        {query.data?.length ? query.data.map((n) => (
          <View key={n.id} className="mb-2.5 flex-row rounded-2xl p-3.5" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: n.read ? t.divider : t.primary }}>
            {!n.read ? <View className="mr-2 mt-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.primary }} /> : null}
            <View className="flex-1">
              <Text className="text-[14px] font-bold" style={{ color: t.ink }}>{n.title}</Text>
              <Text className="text-[13px]" style={{ color: t.secondary }}>{n.body}</Text>
              <Text className="mt-0.5 text-[11px]" style={{ color: t.secondary }}>{timeAgo(n.at)}</Text>
            </View>
          </View>
        )) : (
          <EmptyState title="No notifications" sub="Alerts about documents, bills and assignments will appear here." />
        )}
        <View className="mt-2"><Button title="Back" variant="ghost" onPress={() => router.back()} /></View>
      </ScrollView>
    </SafeAreaView>
  );
}
