import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone } from 'lucide-react-native';
import { fmtDate } from '../../../src/utils/format';
import { Images } from '../../../src/constants/images';
import { services } from '../../../src/services/serviceProvider';
import { qk, useRepoVersion } from '../../../src/hooks/queries';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar, ErrorState } from '../../../src/components/ui/states';
import { Card } from '../../../src/components/ui/Card';
import { Chip } from '../../../src/components/ui/Chip';
import { DonutChart } from '../../../src/components/ui/DonutChart';

const TABS = ['Overview', 'Workers', 'Documents', 'Work Assignments', 'Bills'] as const;

export default function MineDetail() {
  const { t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useRepoVersion();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');

  const mine = useQuery({ queryKey: qk.mine(id!), queryFn: () => services.mines.getMineById(id!), enabled: !!id });
  const summary = useQuery({ queryKey: [...qk.mine(id!), 'summary', v], queryFn: () => services.mines.getMineSummary(id!), enabled: !!id });
  const workers = useQuery({
    queryKey: ['workers', { mineId: id }, v],
    queryFn: () => services.workers.listWorkers({ mineId: id }, 1, 200),
    enabled: !!id,
  });
  const docs = useQuery({
    queryKey: ['docs', { mineId: id }, v],
    queryFn: () => services.documents.listDocuments({ mineId: id }, 1, 100),
    enabled: !!id,
  });
  const bills = useQuery({
    queryKey: ['bills', { mineId: id }, v],
    queryFn: () => services.bills.listBills({ mineId: id }, 1, 100),
    enabled: !!id,
  });
  const history = useQuery({
    queryKey: ['assignments', id, v],
    queryFn: async () => {
      await mockRepo.ready();
      return mockRepo.data.assignments.filter((a) => a.mineId === id).slice(0, 20);
    },
    enabled: !!id,
  });

  if (mine.isPending) {
    return <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: t.appBg }}><Text style={{ color: t.secondary }}>Loading…</Text></SafeAreaView>;
  }
  if (mine.isError || !mine.data) {
    return <SafeAreaView className="flex-1 p-4" style={{ backgroundColor: t.appBg }}><ErrorState message="Mine not found." onRetry={() => router.back()} /></SafeAreaView>;
  }
  const m = mine.data;
  const s = summary.data;
  const docItems = docs.data?.items ?? [];
  const verified = docItems.filter((d) => d.status === 'Verified').length;
  const pending = docItems.filter((d) => d.status === 'Pending').length;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row items-start">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-[22px] font-extrabold" style={{ color: t.ink }}>{m.name}</Text>
              <Chip label={m.status} />
            </View>
            <Text className="text-[13px]" style={{ color: t.secondary }}>{m.state}</Text>
            <Text className="text-[12px]" style={{ color: t.secondary }}>Contract Period: {fmtDate(m.contractStart)} – {fmtDate(m.contractEnd)}</Text>
          </View>
          <Image source={m.image} style={{ width: 120, height: 92, borderRadius: 12, marginLeft: 10 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="my-3" contentContainerStyle={{ gap: 8 }}>
          {TABS.map((tb) => (
            <Pressable key={tb} onPress={() => setTab(tb)} className="rounded-xl px-4 py-2.5" style={{ backgroundColor: tab === tb ? t.navy : t.lightBlue }}>
              <Text className="text-[13px] font-bold" style={{ color: tab === tb ? '#fff' : t.ink }}>{tb}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'Overview' ? (
          <View className="gap-3">
            <View className="flex-row gap-2">
              {[
                [String(s?.total ?? 0), 'Assigned'],
                [String(s?.active ?? 0), 'Active'],
                [String(s?.onLeave ?? 0), 'On Leave'],
                [String(s?.inactive ?? 0), 'Inactive'],
              ].map(([n, l]) => (
                <View key={l as string} className="flex-1 items-center rounded-2xl py-3" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
                  <Text className="text-[19px] font-extrabold" style={{ color: t.ink }}>{n}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>{l}</Text>
                </View>
              ))}
            </View>
            <Card>
              <Text className="mb-1 text-[15px] font-extrabold" style={{ color: t.ink }}>Contract Information</Text>
              <Text className="text-[13px]" style={{ color: t.secondary }}>Contractor</Text>
              <Text className="text-[13px] font-bold" style={{ color: t.ink }}>Shakti Infrastructure Services Pvt. Ltd.</Text>
              <Text className="mt-1 text-[13px]" style={{ color: t.secondary }}>Period · {fmtDate(m.contractStart)} – {fmtDate(m.contractEnd)}</Text>
              <Text className="text-[13px]" style={{ color: t.secondary }}>Work Type · {m.workType}</Text>
            </Card>
            <View className="flex-row gap-3">
              <Card>
                <Text className="mb-1 text-[15px] font-extrabold" style={{ color: t.ink }}>Key Contacts</Text>
                {[[m.managerName, 'Mine Manager', m.managerPhone], [m.nodalName, 'Nodal Officer', m.nodalPhone]].map(([n, r, p]) => (
                  <View key={n as string} className="flex-row items-center py-1.5">
                    <View className="flex-1">
                      <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{n}</Text>
                      <Text className="text-[11px]" style={{ color: t.secondary }}>{r}</Text>
                    </View>
                    <Pressable accessibilityLabel={`Call ${n}`} onPress={() => Linking.openURL(`tel:+${p}`)} className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: t.navy }}>
                      <Phone size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </Card>
            </View>
            <Card>
              <Text className="mb-1 text-[15px] font-extrabold" style={{ color: t.ink }}>Location</Text>
              <Text className="text-[13px]" style={{ color: t.secondary }}>{m.location}</Text>
              <Image source={Images.mineLocation} className="mt-2 h-32 w-full rounded-xl" resizeMode="cover" />
            </Card>
            <Card>
              <Text className="mb-2 text-[15px] font-extrabold" style={{ color: t.ink }}>Worker Distribution</Text>
              <DonutChart
                centerTop={String(s?.total ?? 0)} centerSub="Total Workers"
                segments={[
                  { label: 'Active', value: s?.active ?? 0, color: t.success },
                  { label: 'On Leave', value: s?.onLeave ?? 0, color: t.warning },
                  { label: 'Inactive', value: s?.inactive ?? 0, color: t.danger },
                ]}
              />
            </Card>
            <Card>
              <Text className="mb-1 text-[15px] font-extrabold" style={{ color: t.ink }}>Document Status</Text>
              <Text className="text-[13px]" style={{ color: t.secondary }}>{verified} verified · {pending} pending · {docItems.length} total</Text>
            </Card>
          </View>
        ) : null}

        {tab === 'Workers' ? (
          <Card padded={false}>
            {(workers.data?.items ?? []).map((w, i, arr) => (
              <Pressable key={w.id} className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: t.divider }}
                onPress={() => router.push({ pathname: '/(contractor)/worker/[id]', params: { id: w.id } })}>
                <Avatar label={w.name.split(' ').map((x) => x[0]).join('').slice(0, 2)} size={40} />
                <View className="ml-3 flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{w.name}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>{w.role}</Text>
                </View>
                <Chip label={w.status} />
              </Pressable>
            ))}
          </Card>
        ) : null}

        {tab === 'Documents' ? (
          <Card padded={false}>
            {docItems.map((d, i) => (
              <View key={d.id} className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: i < docItems.length - 1 ? 1 : 0, borderColor: t.divider }}>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{d.type}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>Exp: {fmtDate(d.expiryDate)}</Text>
                </View>
                <Chip label={d.status} />
              </View>
            ))}
            {!docItems.length ? <Text className="p-4 text-[13px]" style={{ color: t.secondary }}>No documents for this mine.</Text> : null}
          </Card>
        ) : null}

        {tab === 'Work Assignments' ? (
          <Card padded={false}>
            {(history.data ?? []).map((a, i, arr) => {
              const w = workers.data?.items.find((x) => x.id === a.workerId);
              return (
                <View key={a.id} className="px-4 py-3" style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: t.divider }}>
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{w?.name ?? a.workerId}</Text>
                  <Text className="text-[12px]" style={{ color: t.secondary }}>{fmtDate(a.from)} → {a.to ? fmtDate(a.to) : 'Present'}</Text>
                </View>
              );
            })}
          </Card>
        ) : null}

        {tab === 'Bills' ? (
          <Card padded={false}>
            {(bills.data?.items ?? []).map((b, i, arr) => (
              <Pressable key={b.id} className="flex-row items-center px-4 py-3"
                style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: t.divider }}
                onPress={() => router.push({ pathname: '/(contractor)/bill/[id]', params: { id: b.id } })}>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{b.id}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>{b.workType} · {fmtDate(b.submittedOn)}</Text>
                </View>
                <Chip label={b.status} />
              </Pressable>
            ))}
            {!(bills.data?.items.length) ? <Text className="p-4 text-[13px]" style={{ color: t.secondary }}>No bills for this mine.</Text> : null}
          </Card>
        ) : null}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
