import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react-native';
import { fmtDate, inr } from '../../../src/utils/format';
import { services } from '../../../src/services/serviceProvider';
import { qk } from '../../../src/hooks/queries';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar, ErrorState } from '../../../src/components/ui/states';
import { Card } from '../../../src/components/ui/Card';
import { Chip } from '../../../src/components/ui/Chip';

export default function BillDetail() {
  const { t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useQuery({ queryKey: qk.bill(id!), queryFn: () => services.bills.getBillById(id!), enabled: !!id });

  if (bill.isPending) {
    return <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: t.appBg }}><Text style={{ color: t.secondary }}>Loading…</Text></SafeAreaView>;
  }
  if (bill.isError || !bill.data) {
    return <SafeAreaView className="flex-1 p-4" style={{ backgroundColor: t.appBg }}><ErrorState message="Bill not found." onRetry={() => router.back()} /></SafeAreaView>;
  }
  const b = bill.data;
  const mine = mockRepo.mineById(b.mineId);
  const steps = ['Pending', 'Approved', 'Paid'];
  const idx = b.status === 'Rejected' ? -1 : steps.indexOf(b.status);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <View className="px-4 pt-2">
        <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-[22px] font-extrabold" style={{ color: t.ink }}>{b.id}</Text>
          <Chip label={b.status} />
        </View>
        <Text className="text-[13px]" style={{ color: t.secondary }}>{b.workType} · {b.period}</Text>
        <Card>
          <Text className="text-[28px] font-extrabold" style={{ color: t.ink }}>{inr(b.amountInr)}</Text>
          <Text className="mt-1 text-[13px]" style={{ color: t.secondary }}>Mine · {mine?.name}</Text>
          <Text className="text-[13px]" style={{ color: t.secondary }}>Submitted · {fmtDate(b.submittedOn)}</Text>
          {b.description ? <Text className="mt-1 text-[13px]" style={{ color: t.ink }}>{b.description}</Text> : null}
        </Card>
        <Card>
          <Text className="mb-2 text-[15px] font-extrabold" style={{ color: t.ink }}>Status timeline</Text>
          {b.status === 'Rejected' ? (
            <Text className="text-[13px]" style={{ color: t.danger }}>Rejected — correct the invoice and resubmit as a new bill.</Text>
          ) : (
            steps.map((s, i) => (
              <View key={s} className="flex-row items-center py-1.5">
                <View className="mr-2.5 h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: i <= idx ? t.success : t.divider }}>
                  {i <= idx ? <Text className="text-[11px] font-bold text-white">✓</Text> : null}
                </View>
                <Text className="text-[13px] font-semibold" style={{ color: i <= idx ? t.ink : t.secondary }}>{s}</Text>
              </View>
            ))
          )}
          <Text className="mt-2 text-[11px]" style={{ color: t.secondary }}>
            Submission, approval and payment are separate steps. Contractors cannot approve their own bills.
          </Text>
        </Card>
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
