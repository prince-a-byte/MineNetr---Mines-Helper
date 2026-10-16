import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MoreVertical, Upload } from 'lucide-react-native';
import { fmtDate } from '../../src/utils/format';
import { services } from '../../src/services/serviceProvider';
import { useRepoVersion } from '../../src/hooks/queries';
import { mockRepo } from '../../src/repositories/mockStore';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader } from '../../src/components/ui/dialogs';
import { Avatar, EmptyState, ErrorState } from '../../src/components/ui/states';
import { SearchBar } from '../../src/components/ui/SearchBar';
import { SelectSheet } from '../../src/components/ui/SelectSheet';
import { Chip } from '../../src/components/ui/Chip';
import { DOC_TYPES } from '../../src/constants/roles';

export default function Documents() {
  const { t } = useTheme();
  const v = useRepoVersion();
  const [scope, setScope] = useState<'worker' | 'company'>('worker');
  const [q, setQ] = useState('');
  const [mineId, setMineId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const mines = mockRepo.mines();

  const filters = useMemo(() => ({
    q, scope, mineId: mineId || undefined, type: type || undefined, status: status || undefined,
  }), [q, scope, mineId, type, status]);

  const query = useQuery({
    queryKey: ['docs', filters, v],
    queryFn: () => services.documents.listDocuments(filters, 1, 200),
  });
  const all = useQuery({
    queryKey: ['docs', 'counts', v],
    queryFn: () => services.documents.listDocuments({ scope: 'all' }, 1, 500),
  });
  const items = all.data?.items ?? [];
  const counts = {
    verified: items.filter((d) => d.status === 'Verified').length,
    pending: items.filter((d) => d.status === 'Pending').length,
    rejected: items.filter((d) => d.status === 'Rejected' || d.status === 'Expired').length,
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader
          left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>}
          right={<Avatar label="CT" size={38} />}
        />
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-[24px] font-extrabold" style={{ color: t.ink }}>Documents</Text>
            <Text className="text-[12px]" style={{ color: t.secondary }}>Manage and track all worker and company documents</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(contractor)/document/upload')}
            className="flex-row items-center rounded-xl px-3.5 py-2.5" style={{ backgroundColor: t.navy }}>
            <Upload size={15} color="#fff" />
            <Text className="ml-1 text-[13px] font-bold text-white">Upload</Text>
          </Pressable>
        </View>
        <View className="mt-3 flex-row gap-2">
          {(['worker', 'company'] as const).map((s) => (
            <Pressable key={s} onPress={() => setScope(s)} className="flex-1 rounded-xl py-2.5" style={{ backgroundColor: scope === s ? t.navy : t.lightBlue }}>
              <Text className="text-center text-[13px] font-bold" style={{ color: scope === s ? '#fff' : t.ink }}>
                {s === 'worker' ? 'Worker Documents' : 'Company Documents'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="mt-2 flex-row gap-2">
          {[
            [String(counts.verified), 'Verified', '#E4F5EC'],
            [String(counts.pending), 'Pending', '#FDF1E2'],
            [String(counts.rejected), 'Rejected', '#FBE7E9'],
          ].map(([n, l, bg]) => (
            <View key={l as string} className="flex-1 items-center rounded-2xl py-2.5" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
              <Text className="rounded-lg px-2 text-[15px] font-extrabold" style={{ backgroundColor: bg as string, color: t.ink }}>{n}</Text>
              <Text className="mt-0.5 text-[11px]" style={{ color: t.secondary }}>{l}</Text>
            </View>
          ))}
        </View>
        <View className="mt-2">
          <SearchBar value={q} onChange={setQ} placeholder="Search by worker name, ID, or document type…" />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <SelectSheet placeholder="All Mines" value={mines.find((m) => m.id === mineId)?.name}
                options={['All Mines', ...mines.map((m) => m.name)]}
                onPick={(n) => setMineId(n === 'All Mines' ? '' : mines.find((m) => m.name === n)?.id ?? '')} />
            </View>
            <View className="flex-1">
              <SelectSheet placeholder="All Types" value={type || undefined} options={['All Types', ...DOC_TYPES]} onPick={(x) => setType(x === 'All Types' ? '' : x)} />
            </View>
            <View className="flex-1">
              <SelectSheet placeholder="All Status" value={status || undefined} options={['All Status', 'Verified', 'Pending', 'Rejected', 'Expired']} onPick={(x) => setStatus(x === 'All Status' ? '' : x)} />
            </View>
          </View>
        </View>
      </View>
      {query.isPending ? (
        <View className="flex-1 items-center justify-center"><Text style={{ color: t.secondary }}>Loading documents…</Text></View>
      ) : query.isError ? (
        <View className="px-4"><ErrorState message="Could not load documents." onRetry={() => query.refetch()} /></View>
      ) : query.data.items.length === 0 ? (
        <View className="px-4"><EmptyState title="No documents found" sub="Upload a document to get started." actionLabel="Upload Document" onAction={() => router.push('/(contractor)/document/upload')} /></View>
      ) : (
        <FlatList
          data={query.data.items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          renderItem={({ item }) => {
            const w = item.workerId ? mockRepo.data.workers.find((x) => x.id === item.workerId) : undefined;
            const mine = mockRepo.mineById(item.mineId);
            return (
              <View className="mb-2.5 flex-row items-center rounded-2xl p-3" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{item.type}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>
                    {w ? `${w.name} · ` : ''}{mine?.name} · Exp {fmtDate(item.expiryDate)}
                  </Text>
                </View>
                <Chip label={item.status} />
                <MoreVertical size={18} color={t.secondary} />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
