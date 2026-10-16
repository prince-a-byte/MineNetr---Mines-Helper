import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Menu } from 'lucide-react-native';
import { fmtDate } from '../../../src/utils/format';
import { services } from '../../../src/services/serviceProvider';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar, EmptyState, ErrorState, SectionHeader } from '../../../src/components/ui/states';
import { SearchBar } from '../../../src/components/ui/SearchBar';
import { SelectSheet } from '../../../src/components/ui/SelectSheet';

export default function Mines() {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'All' | 'Active' | 'Inactive'>('All');
  const query = useQuery({ queryKey: ['mines', q, status], queryFn: () => services.mines.listAssignedMines(q, status) });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader left={<Menu size={24} color={t.ink} />} right={<Avatar label="CT" size={38} />} />
        <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>My Mines</Text>
        <Text className="text-[12px]" style={{ color: t.secondary }}>Mines assigned to your company</Text>
        <View className="mt-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search mines by name or location…" />
          <SelectSheet placeholder="All" value={status} options={['All', 'Active', 'Inactive']} onPick={(v) => setStatus(v as typeof status)} />
        </View>
      </View>
      {query.isPending ? (
        <View className="flex-1 items-center justify-center"><Text style={{ color: t.secondary }}>Loading mines…</Text></View>
      ) : query.isError ? (
        <View className="px-4"><ErrorState message="Could not load mines." onRetry={() => query.refetch()} /></View>
      ) : (query.data?.length ?? 0) === 0 ? (
        <View className="px-4"><EmptyState title="No mines found" sub="Only mines assigned to your company are listed." /></View>
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          ListHeaderComponent={
            <View className="mb-2 rounded-2xl p-3" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
              <SectionHeader title="Mine-wise Summary" />
              <Text className="text-[13px]" style={{ color: t.secondary }}>
                {query.data!.length} assigned mines · {query.data!.filter((m) => m.status === 'Active').length} active
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/(contractor)/mine/[id]', params: { id: item.id } })}
              className="mb-3 overflow-hidden rounded-2xl"
              style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}
            >
              <View className="flex-row p-3">
                <Image source={item.image} style={{ width: 104, height: 104, borderRadius: 12 }} />
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-[15px] font-extrabold" style={{ color: t.ink }}>{item.name}</Text>
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: item.status === 'Active' ? '#E4F5EC' : '#FBE7E9' }}>
                      <Text className="text-[11px] font-bold" style={{ color: item.status === 'Active' ? t.success : t.danger }}>{item.status}</Text>
                    </View>
                  </View>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>{item.location}</Text>
                  <Text className="mt-1 text-[12px]" style={{ color: t.secondary }}>Contract: {fmtDate(item.contractStart)} – {fmtDate(item.contractEnd)}</Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Link href="/(contractor)/worker/new" asChild>
                      <Text className="text-[12px] font-bold" style={{ color: t.primary }}>+ Add Worker to Mine</Text>
                    </Link>
                    <ChevronRight size={20} color={t.secondary} />
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
