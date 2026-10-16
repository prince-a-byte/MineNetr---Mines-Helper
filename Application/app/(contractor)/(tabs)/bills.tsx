import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Menu, Plus } from 'lucide-react-native';
import { fmtDate, inr } from '../../../src/utils/format';
import { services } from '../../../src/services/serviceProvider';
import { useRepoVersion } from '../../../src/hooks/queries';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar, EmptyState, ErrorState, SectionHeader } from '../../../src/components/ui/states';
import { SearchBar } from '../../../src/components/ui/SearchBar';
import { Chip } from '../../../src/components/ui/Chip';
import type { Bill } from '../../../src/types/models';

const TABS = ['All', 'Pending', 'Approved', 'Rejected'] as const;

export default function Bills() {
  const { t } = useTheme();
  const v = useRepoVersion();
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [q, setQ] = useState('');

  const filters = useMemo(() => ({
    q,
    status: (tab === 'All' ? 'All' : tab) as Bill['status'] | 'All',
  }), [q, tab]);

  const query = useQuery({
    queryKey: ['bills', filters, v],
    queryFn: () => services.bills.listBills(filters, 1, 200),
  });
  const txns = useQuery({ queryKey: ['txns', v], queryFn: () => services.bills.listTransactions() });

  const all = query.data?.items ?? [];
  const totals = useMemo(() => {
    const sum = (f: (b: Bill) => boolean) => all.filter(f).reduce((a, b) => a + b.amountInr, 0);
    return {
      total: all.reduce((a, b) => a + b.amountInr, 0),
      approved: sum((b) => b.status === 'Approved' || b.status === 'Paid'),
      pending: sum((b) => b.status === 'Pending'),
      rejected: sum((b) => b.status === 'Rejected'),
    };
  }, [all]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader left={<Menu size={24} color={t.ink} />} right={<Avatar label="CT" size={38} />} />
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-[24px] font-extrabold" style={{ color: t.ink }}>Bills & Transactions</Text>
            <Text className="text-[12px]" style={{ color: t.secondary }}>Submit invoices and track payment status</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(contractor)/bill/new')}
            className="flex-row items-center rounded-xl px-3.5 py-2.5" style={{ backgroundColor: t.navy }}>
            <Plus size={16} color="#fff" />
            <Text className="ml-1 text-[13px] font-bold text-white">Submit Bill</Text>
          </Pressable>
        </View>
        <View className="mt-3 flex-row gap-2">
          {[
            [inr(totals.total), 'Total Billed', '#EAF3FF'],
            [inr(totals.approved), 'Approved', '#E4F5EC'],
            [inr(totals.pending), 'Pending', '#FDF1E2'],
            [inr(totals.rejected), 'Rejected', '#FBE7E9'],
          ].map(([val, label, bg]) => (
            <View key={label as string} className="flex-1 items-center rounded-2xl py-3" style={{ backgroundColor: bg as string }}>
              <Text className="text-[13px] font-extrabold" style={{ color: t.ink }}>{val}</Text>
              <Text className="text-[10px]" style={{ color: t.secondary }}>{label}</Text>
            </View>
          ))}
        </View>
        <View className="mt-2 flex-row gap-2">
          {TABS.map((tb) => (
            <Pressable key={tb} onPress={() => setTab(tb)} className="flex-1 rounded-xl py-2.5" style={{ backgroundColor: tab === tb ? t.navy : t.lightBlue }}>
              <Text className="text-center text-[12px] font-bold" style={{ color: tab === tb ? '#fff' : t.ink }}>{tb}</Text>
            </Pressable>
          ))}
        </View>
        <View className="mt-2"><SearchBar value={q} onChange={setQ} placeholder="Search by bill number, mine, work type…" /></View>
      </View>
      {query.isPending ? (
        <View className="flex-1 items-center justify-center"><Text style={{ color: t.secondary }}>Loading bills…</Text></View>
      ) : query.isError ? (
        <View className="px-4"><ErrorState message="Could not load bills." onRetry={() => query.refetch()} /></View>
      ) : all.length === 0 ? (
        <View className="px-4"><EmptyState title="No bills found" sub="Submit your first invoice." actionLabel="Submit Bill" onAction={() => router.push('/(contractor)/bill/new')} /></View>
      ) : (
        <FlatList
          data={all}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          ListFooterComponent={
            <View className="mt-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
              <SectionHeader title="Recent Transactions" actionLabel="View All" onAction={() => {}} />
              {(txns.data ?? []).slice(0, 3).map((p) => (
                <View key={p.id} className="flex-row items-center py-2">
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold" style={{ color: t.ink }}>Payment Received</Text>
                    <Text className="text-[11px]" style={{ color: t.secondary }}>{p.billId} · {fmtDate(p.date)}</Text>
                  </View>
                  <Text className="text-[14px] font-extrabold" style={{ color: t.success }}>{inr(p.amountInr)}</Text>
                </View>
              ))}
              {!txns.data?.length ? <Text className="text-[12px]" style={{ color: t.secondary }}>No payments recorded yet.</Text> : null}
            </View>
          }
          renderItem={({ item }) => {
            const mine = mockRepo.mineById(item.mineId);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/(contractor)/bill/[id]', params: { id: item.id } })}
                className="mb-2.5 flex-row items-center rounded-2xl p-3"
                style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}
              >
                <View className="flex-1">
                  <Text className="text-[13px] font-extrabold" style={{ color: t.ink }}>{item.id}</Text>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>{item.workType} · {item.period}</Text>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>{mine?.name} · {fmtDate(item.submittedOn)}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[14px] font-extrabold" style={{ color: t.ink }}>{inr(item.amountInr)}</Text>
                  <View className="mt-1 flex-row items-center">
                    <Chip label={item.status} />
                    <ChevronRight size={16} color={t.secondary} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
