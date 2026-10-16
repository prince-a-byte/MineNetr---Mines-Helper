import { ImageBackground, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, FilePlus, FolderUp, HardHat, MapPin, Menu, Upload, UserPlus, Users } from 'lucide-react-native';
import { Images } from '../../../src/constants/images';
import { inr, timeAgo } from '../../../src/utils/format';
import { useActivities, useDashboard, useNotifications } from '../../../src/hooks/queries';
import { useSessionStore } from '../../../src/store/session';
import { useTheme } from '../../../src/theme/ThemeContext';
import { Avatar, DemoBadge, EmptyState } from '../../../src/components/ui/states';
import { Card } from '../../../src/components/ui/Card';

function Kpi({ icon, value, label, tint, onPress }: { icon: React.ReactNode; value: string; label: string; tint: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-1 rounded-2xl p-3" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider, minWidth: '47%' }}>
      <View className="mb-2 h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tint }}>{icon}</View>
      <Text className="text-[19px] font-extrabold" style={{ color: t.ink }}>{value}</Text>
      <Text className="text-[11px]" style={{ color: t.secondary }}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { t } = useTheme();
  const session = useSessionStore((s) => s.session);
  const dash = useDashboard();
  const acts = useActivities(5);
  const notifs = useNotifications();
  const refreshing = dash.isRefetching || acts.isRefetching;
  const unread = (notifs.data ?? []).filter((n) => !n.read).length;
  const d = dash.data;

  const actions = [
    { icon: <UserPlus size={22} color={t.primary} />, label: 'Manage Workers', href: '/(contractor)/(tabs)/workers' },
    { icon: <Upload size={22} color={t.primary} />, label: 'Upload Document', href: '/(contractor)/document/upload' },
    { icon: <FilePlus size={22} color={t.primary} />, label: 'Submit Bill', href: '/(contractor)/bill/new' },
    { icon: <MapPin size={22} color={t.primary} />, label: 'My Mines', href: '/(contractor)/(tabs)/mines' },
  ] as const;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { dash.refetch(); acts.refetch(); notifs.refetch(); }} />}
      >
        <View className="flex-row items-center">
          <Menu size={24} color={t.ink} />
          <View className="mx-2 flex-row items-baseline">
            <Text className="text-[22px] font-extrabold" style={{ color: t.navy }}>Mine</Text>
            <Text className="text-[22px] font-extrabold" style={{ color: t.primary }}>Netr</Text>
          </View>
          <View className="ml-auto flex-row items-center gap-2">
            <DemoBadge />
            <Pressable accessibilityLabel="Notifications" onPress={() => router.push('/(contractor)/notifications')} className="relative p-1">
              <Bell size={22} color={t.ink} />
              {unread > 0 ? (
                <View className="absolute -right-0.5 -top-0.5 h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1">
                  <Text className="text-[9px] font-bold text-white">{unread}</Text>
                </View>
              ) : null}
            </Pressable>
            <Avatar label="CT" size={38} />
          </View>
        </View>

        <Text className="mt-3 text-[19px] font-extrabold" style={{ color: t.ink }}>
          Hello, {session?.displayName?.replace(' Pvt. Ltd.', '') ?? 'Contractor'}
        </Text>
        <Text className="text-[13px]" style={{ color: t.secondary }}>Here&apos;s your contractor dashboard.</Text>

        <View className="mt-3 overflow-hidden rounded-2xl">
          <ImageBackground source={Images.bannerHome} className="p-5" resizeMode="cover" style={{ minHeight: 132 }}>
            <View className="absolute inset-0 bg-[#0B3154]/45" />
            <Text className="text-[19px] font-extrabold leading-6 text-white">Manage Workforce.{'\n'}Build Safer Mines.</Text>
            <Text className="mt-1 max-w-[240px] text-[12px] leading-4 text-white/90">
              Stay compliant with DGMS requirements and track every project.
            </Text>
          </ImageBackground>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2.5">
          <Kpi icon={<Users size={20} color={t.primary} />} value={d ? String(d.totalWorkers) : '–'} label="Total Workers" tint={t.lightBlue} onPress={() => router.push('/(contractor)/(tabs)/workers')} />
          <Kpi icon={<HardHat size={20} color={t.success} />} value={d ? String(d.activeWorkers) : '–'} label="Active Workers" tint="#E4F5EC" onPress={() => router.push('/(contractor)/(tabs)/workers')} />
          <Kpi icon={<MapPin size={20} color="#C77E1A" />} value={d ? String(d.assignedMines) : '–'} label="Assigned Mines" tint="#FDF1E2" onPress={() => router.push('/(contractor)/(tabs)/mines')} />
          <Kpi icon={<FolderUp size={20} color={t.danger} />} value={d ? String(d.pendingDocuments) : '–'} label="Pending Documents" tint="#FBE7E9" onPress={() => router.push('/(contractor)/documents')} />
        </View>
        {d ? (
          <Card>
            <View className="mt-1 flex-row items-center justify-between border-t pt-3" style={{ borderColor: t.divider }}>
              <Text className="text-[12px]" style={{ color: t.secondary }}>Billed so far</Text>
              <Text className="text-[14px] font-extrabold" style={{ color: t.ink }}>{inr(d.totalBilledInr)}</Text>
            </View>
          </Card>
        ) : null}

        <Text className="mb-2 mt-5 text-[16px] font-extrabold" style={{ color: t.ink }}>Quick Actions</Text>
        <View className="flex-row flex-wrap gap-2.5">
          {actions.map((a) => (
            <Link key={a.label} href={a.href} asChild>
              <Pressable className="items-center rounded-2xl py-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider, width: '48%' }}>
                <View className="mb-1.5 h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: t.lightBlue }}>{a.icon}</View>
                <Text className="text-[12px] font-bold" style={{ color: t.ink }}>{a.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <View className="mb-2 mt-5 flex-row items-center justify-between">
          <Text className="text-[16px] font-extrabold" style={{ color: t.ink }}>Recent Updates</Text>
          <Link href="/(contractor)/notifications" asChild>
            <Text className="text-[13px] font-bold" style={{ color: t.primary }}>View All</Text>
          </Link>
        </View>
        {acts.data?.length ? (
          <Card padded={false}>
            {acts.data.map((a, i) => (
              <View key={a.id} className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: i < acts.data!.length - 1 ? 1 : 0, borderColor: t.divider }}>
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: t.lightBlue }}>
                  <Text className="text-[13px] font-bold" style={{ color: t.primary }}>{a.kind.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold" style={{ color: t.ink }}>{a.text}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>{timeAgo(a.at)}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState title="No updates yet" sub="Activity from your workforce will appear here." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
