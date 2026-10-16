import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Menu, Plus } from 'lucide-react-native';
import { JOB_ROLES } from '../../../src/constants/roles';
import { services } from '../../../src/services/serviceProvider';
import { qk, useRepoVersion } from '../../../src/hooks/queries';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useTheme } from '../../../src/theme/ThemeContext';
import { Avatar, EmptyState, ErrorState } from '../../../src/components/ui/states';
import { SearchBar, SegmentedTabs } from '../../../src/components/ui/SearchBar';
import { SelectSheet } from '../../../src/components/ui/SelectSheet';
import { AppHeader } from '../../../src/components/ui/dialogs';
import type { WorkerStatus } from '../../../src/types/models';

const TABS = ['All', 'Active', 'On Leave', 'Inactive'] as const;

export default function Workers() {
  const { t } = useTheme();
  const v = useRepoVersion();
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [q, setQ] = useState('');
  const [mineId, setMineId] = useState('');
  const [role, setRole] = useState('');
  const mines = mockRepo.mines();

  const filters = useMemo(() => ({
    q,
    status: (tab === 'All' ? undefined : tab) as WorkerStatus | undefined,
    mineId: mineId || undefined,
    role: role || undefined,
  }), [q, tab, mineId, role]);

  const query = useQuery({
    queryKey: [...qk.workers(filters), v],
    queryFn: () => services.workers.listWorkers(filters, 1, 200),
  });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader left={<Menu size={24} color={t.ink} />} right={<Avatar label="CT" size={38} />} />
        <View className="mt-1 flex-row items-end justify-between">
          <View>
            <Text className="text-[24px] font-extrabold" style={{ color: t.ink }}>Workers</Text>
            <Text className="text-[12px]" style={{ color: t.secondary }}>Manage your workforce across all assigned mines</Text>
          </View>
          <Link href="/(contractor)/worker/new" asChild>
            <Pressable accessibilityRole="button" className="flex-row items-center rounded-xl px-3.5 py-2.5" style={{ backgroundColor: t.navy }}>
              <Plus size={16} color="#fff" />
              <Text className="ml-1 text-[13px] font-bold text-white">Add Worker</Text>
            </Pressable>
          </Link>
        </View>
        <View className="mt-3">
          <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
          <SearchBar value={q} onChange={setQ} placeholder="Search worker by name or ID…" />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <SelectSheet placeholder="All Mines" value={mines.find((m) => m.id === mineId)?.name}
                options={['All Mines', ...mines.map((m) => m.name)]}
                onPick={(name) => setMineId(name === 'All Mines' ? '' : mines.find((m) => m.name === name)?.id ?? '')} />
            </View>
            <View className="flex-1">
              <SelectSheet placeholder="All Roles" value={role || undefined}
                options={['All Roles', ...JOB_ROLES]}
                onPick={(r) => setRole(r === 'All Roles' ? '' : r)} />
            </View>
          </View>
        </View>
      </View>
      {query.isPending ? (
        <View className="flex-1 items-center justify-center"><Text style={{ color: t.secondary }}>Loading workers…</Text></View>
      ) : query.isError ? (
        <View className="px-4"><ErrorState message="Could not load workers." onRetry={() => query.refetch()} /></View>
      ) : query.data.items.length === 0 ? (
        <View className="px-4"><EmptyState title="No workers found" sub="Try a different search or filter." actionLabel="Add Worker" onAction={() => router.push('/(contractor)/worker/new')} /></View>
      ) : (
        <FlatList
          data={query.data.items}
          keyExtractor={(w) => w.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          renderItem={({ item }) => {
            const mine = mines.find((m) => m.id === item.mineId);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/(contractor)/worker/[id]', params: { id: item.id } })}
                className="mb-2.5 flex-row items-center rounded-2xl p-3"
                style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}
              >
                {typeof item.avatar === 'number'
                  ? <Image source={item.avatar} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  : <Avatar label={item.name.split(' ').map((x) => x[0]).join('').slice(0, 2)} size={52} />}
                <View className="ml-3 flex-1">
                  <Text className="text-[14px] font-bold" style={{ color: t.ink }}>{item.name}</Text>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>ID: {item.id}</Text>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>{item.role} · {mine?.name}</Text>
                </View>
                <View className="items-end">
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: item.status === 'Active' ? '#E4F5EC' : item.status === 'On Leave' ? '#FDF1E2' : '#FBE7E9' }}>
                    <Text className="text-[11px] font-bold" style={{ color: item.status === 'Active' ? t.success : item.status === 'On Leave' ? '#C77E1A' : t.danger }}>{item.status}</Text>
                  </View>
                  <ChevronRight size={18} color={t.secondary} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
