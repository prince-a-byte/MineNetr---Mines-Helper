import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MoreVertical } from 'lucide-react-native';
import { fmtDate, maskAadhaar } from '../../../src/utils/format';
import { services } from '../../../src/services/serviceProvider';
import { qk, useInvalidation, useRepoVersion } from '../../../src/hooks/queries';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar, ErrorState } from '../../../src/components/ui/states';
import { Card } from '../../../src/components/ui/Card';
import { Chip } from '../../../src/components/ui/Chip';
import { Button } from '../../../src/components/ui/Button';
import { ConfirmDialog } from '../../../src/components/ui/dialogs';
import { SelectSheet } from '../../../src/components/ui/SelectSheet';
import type { WorkerStatus } from '../../../src/types/models';

const PROFILE_TABS = ['Overview', 'Documents', 'Work History', 'Attendance', 'Training'] as const;

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  const { t } = useTheme();
  return (
    <View className="flex-row justify-between py-2" style={{ borderBottomWidth: last ? 0 : 1, borderColor: t.divider }}>
      <Text className="text-[13px]" style={{ color: t.secondary }}>{k}</Text>
      <Text className="ml-4 flex-1 text-right text-[13px] font-semibold" style={{ color: t.ink }}>{v}</Text>
    </View>
  );
}

export default function WorkerDetail() {
  const { t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useRepoVersion();
  const invalidate = useInvalidation();
  const [tab, setTab] = useState<(typeof PROFILE_TABS)[number]>('Overview');
  const [confirm, setConfirm] = useState<null | 'inactive' | 'transfer'>(null);
  const [busy, setBusy] = useState(false);
  const [transferMine, setTransferMine] = useState('');
  const mines = mockRepo.mines();

  const worker = useQuery({ queryKey: [...qk.worker(id!), v], queryFn: () => services.workers.getWorkerById(id!), enabled: !!id });
  const docs = useQuery({
    queryKey: ['docs', 'worker', id, v],
    queryFn: () => services.documents.listDocuments({ scope: 'worker', q: id }, 1, 50),
    enabled: !!id,
  });
  const history = useQuery({
    queryKey: ['assignments', id, v],
    queryFn: async () => {
      await mockRepo.ready();
      return mockRepo.data.assignments.filter((a) => a.workerId === id);
    },
    enabled: !!id,
  });

  async function setStatus(s: WorkerStatus) {
    setBusy(true);
    try {
      await services.workers.updateWorkerStatus(id!, s);
      invalidate();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }
  async function transfer() {
    if (!transferMine) return;
    setBusy(true);
    try {
      await services.workers.transferWorker(id!, transferMine);
      invalidate();
    } finally {
      setBusy(false);
      setConfirm(null);
      setTransferMine('');
    }
  }

  if (worker.isPending) {
    return <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: t.appBg }}><Text style={{ color: t.secondary }}>Loading…</Text></SafeAreaView>;
  }
  if (worker.isError || !worker.data) {
    return <SafeAreaView className="flex-1 p-4" style={{ backgroundColor: t.appBg }}><ErrorState message="Worker not found." onRetry={() => router.back()} /></SafeAreaView>;
  }
  const w = worker.data;
  const mine = mines.find((m) => m.id === w.mineId);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader
          left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>}
          right={<View className="flex-row items-center"><Avatar label="CT" size={38} /><MoreVertical size={20} color={t.ink} /></View>}
        />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <Card>
          <View className="flex-row">
            {typeof w.avatar === 'number'
              ? <Image source={w.avatar} style={{ width: 84, height: 84, borderRadius: 42 }} />
              : <Avatar label={w.name.split(' ').map((x) => x[0]).join('').slice(0, 2)} size={84} />}
            <View className="ml-3 flex-1">
              <Text className="text-[19px] font-extrabold" style={{ color: t.ink }}>{w.name}</Text>
              <Text className="text-[12px]" style={{ color: t.secondary }}>ID: {w.id}</Text>
              <Text className="text-[13px] font-semibold" style={{ color: t.ink }}>{w.role}</Text>
              <Text className="text-[12px]" style={{ color: t.secondary }}>+91 {w.phone.replace(/^91/, '')}</Text>
              <View className="mt-1 flex-row gap-2">
                <Chip label={w.status} />
              </View>
            </View>
          </View>
          <View className="mt-2 flex-row gap-4">
            <Text className="text-[12px]" style={{ color: t.secondary }}>Aadhaar: {maskAadhaar(w.aadhaarLast4)}</Text>
            <Text className="text-[12px]" style={{ color: t.secondary }}>DOB: {fmtDate(w.dob)}</Text>
          </View>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="my-3" contentContainerStyle={{ gap: 8 }}>
          {PROFILE_TABS.map((tb) => (
            <Pressable key={tb} onPress={() => setTab(tb)} className="rounded-xl px-4 py-2.5" style={{ backgroundColor: tab === tb ? t.navy : t.lightBlue }}>
              <Text className="text-[13px] font-bold" style={{ color: tab === tb ? '#fff' : t.ink }}>{tb}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'Overview' ? (
          <View className="gap-3">
            <Card>
              <Text className="mb-1 text-[15px] font-extrabold" style={{ color: t.ink }}>Current Assignment</Text>
              <Text className="text-[14px] font-bold" style={{ color: t.primary }}>{mine?.name}</Text>
              <Text className="text-[12px]" style={{ color: t.secondary }}>{mine?.location} · {w.employmentType}</Text>
              <Text className="text-[12px]" style={{ color: t.secondary }}>Joined {fmtDate(w.joiningDate)}</Text>
            </Card>
            <Card>
              <View className="flex-row items-center justify-between">
                <Text className="text-[15px] font-extrabold" style={{ color: t.ink }}>Personal Information</Text>
                <Text className="text-[12px] font-bold" style={{ color: t.primary }}>✎ Edit</Text>
              </View>
              <Row k="Full Name" v={w.name} />
              <Row k="Aadhaar Number" v={maskAadhaar(w.aadhaarLast4)} />
              <Row k="Date of Birth" v={fmtDate(w.dob)} />
              <Row k="Gender" v={w.gender} />
              <Row k="Contact Number" v={`+91 ${w.phone.replace(/^91/, '')}`} />
              {w.address ? <Row k="Address" v={w.address} last /> : null}
            </Card>
            <Card>
              <Text className="text-[15px] font-extrabold" style={{ color: t.ink }}>Emergency Contact</Text>
              <Row k="Contact Name" v={w.emergencyName || '—'} />
              <Row k="Contact Number" v={w.emergencyPhone ? `+91 ${w.emergencyPhone.replace(/^91/, '')}` : '—'} last />
            </Card>
          </View>
        ) : null}

        {tab === 'Documents' ? (
          <Card padded={false}>
            {(docs.data?.items ?? []).map((d, i, arr) => (
              <Pressable key={d.id} className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: t.divider }}>
                <View className="flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{d.type}</Text>
                  <Text className="text-[11px]" style={{ color: t.secondary }}>Exp: {fmtDate(d.expiryDate)}</Text>
                </View>
                <Chip label={d.status} />
              </Pressable>
            ))}
            {!docs.data?.items.length ? <Text className="p-4 text-[13px]" style={{ color: t.secondary }}>No documents for this worker yet.</Text> : null}
          </Card>
        ) : null}

        {tab === 'Work History' ? (
          <Card padded={false}>
            {(history.data ?? []).map((a, i, arr) => (
              <View key={a.id} className="px-4 py-3" style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: t.divider }}>
                <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{mines.find((m) => m.id === a.mineId)?.name}</Text>
                <Text className="text-[12px]" style={{ color: t.secondary }}>{fmtDate(a.from)} → {a.to ? fmtDate(a.to) : 'Present'} · {a.status}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {tab === 'Attendance' ? (
          <Card>
            <Row k="This Month" v="22 / 26 Days" />
            <Row k="On Leave" v="0 Days" />
            <Row k="Last Working Date" v="14 Oct 2026" last />
            <Text className="mt-1 text-[11px]" style={{ color: t.secondary }}>Demo attendance summary for the current cycle.</Text>
          </Card>
        ) : null}

        {tab === 'Training' ? (
          <Card>
            {['Excavator Operation Training — Completed · 12 Jan 2025', 'Mine Safety Training — Completed · 10 Feb 2025'].map((tr, i, arr) => (
              <View key={tr} className="flex-row items-center py-2.5" style={{ borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderColor: t.divider }}>
                <View className="mr-2.5 h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: '#E4F5EC' }}>
                  <Text className="text-[12px] font-bold" style={{ color: t.success }}>✓</Text>
                </View>
                <Text className="flex-1 text-[13px]" style={{ color: t.ink }}>{tr}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View className="mt-4 flex-row gap-2">
          <View className="flex-1">
            <Button title={w.status === 'Active' ? 'Mark as Inactive' : 'Mark as Active'} variant="ghost"
              onPress={() => setConfirm('inactive')} />
          </View>
          <View className="flex-1">
            <Button title="Transfer Mine" variant="secondary" onPress={() => setConfirm('transfer')} />
          </View>
        </View>
        <View className="h-6" />
      </ScrollView>

      <ConfirmDialog
        visible={confirm === 'inactive'}
        title={w.status === 'Active' ? 'Mark worker inactive?' : 'Reactivate worker?'}
        body={`${w.name} (${w.id}) will be ${w.status === 'Active' ? 'marked Inactive and lose mine access' : 'marked Active again'}.`}
        confirmLabel="Confirm" danger={w.status === 'Active'}
        onCancel={() => setConfirm(null)} busy={busy}
        onConfirm={() => setStatus(w.status === 'Active' ? 'Inactive' : 'Active')}
      />
      <ConfirmDialog
        visible={confirm === 'transfer'}
        title="Transfer to another mine"
        body="Choose the destination mine. History is preserved and counts update everywhere."
        confirmLabel="Transfer"
        onCancel={() => setConfirm(null)} busy={busy}
        onConfirm={transfer}
      />
      {confirm === 'transfer' ? (
        <View className="absolute inset-x-4 bottom-10 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
          <SelectSheet label="Destination mine" placeholder="Select mine" value={mines.find((m) => m.id === transferMine)?.name}
            options={mines.filter((m) => m.id !== w.mineId).map((m) => m.name)}
            onPick={(n) => setTransferMine(mines.find((m) => m.name === n)?.id ?? '')} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
