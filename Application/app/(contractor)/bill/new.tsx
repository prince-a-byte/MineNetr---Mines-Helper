import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react-native';
import { billSchema, type BillInput } from '../../../src/schemas/forms';
import { services } from '../../../src/services/serviceProvider';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useInvalidation } from '../../../src/hooks/queries';
import { inr } from '../../../src/utils/format';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar } from '../../../src/components/ui/states';
import { Button } from '../../../src/components/ui/Button';
import { SelectSheet } from '../../../src/components/ui/SelectSheet';
import { TextField } from '../../../src/components/ui/TextField';
import { ApiError } from '../../../src/services/ApiError';

const WORK_TYPES = ['Labor Charges', 'Equipment Charges', 'Material Supply', 'Transport Charges'];

export default function NewBill() {
  const { t } = useTheme();
  const invalidate = useInvalidation();
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const mines = mockRepo.mines();

  const { control, handleSubmit, watch, formState: { errors } } = useForm<BillInput>({
    resolver: zodResolver(billSchema),
    defaultValues: { workType: 'Labor Charges', period: 'Jan 2026' },
  });
  const amount = watch('amountInr');

  async function submit(v: BillInput) {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try {
      const b = await services.bills.createBill(v);
      invalidate();
      router.replace({ pathname: '/(contractor)/bill/[id]', params: { id: b.id } });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Could not submit the bill.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-4 pt-2">
          <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
          <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>Submit Bill</Text>
          <Text className="text-[12px]" style={{ color: t.secondary }}>Review carefully — approval and payment are separate steps.</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View className="rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
            <Controller control={control} name="mineId" render={({ field: { onChange, value } }) => (
              <SelectSheet label="Assigned Mine" required placeholder="Select mine"
                value={mines.find((m) => m.id === value)?.name}
                options={mines.map((m) => m.name)}
                onPick={(n) => onChange(mines.find((m) => m.name === n)?.id ?? '')} error={errors.mineId?.message} />
            )} />
            <Controller control={control} name="workType" render={({ field: { onChange, value } }) => (
              <SelectSheet label="Contract / Work Type" required placeholder="Select type" value={value} options={WORK_TYPES} onPick={onChange} error={errors.workType?.message} />
            )} />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller control={control} name="period" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Billing Period" required placeholder="Jan 2026" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.period?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="amountInr" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Amount (₹)" required placeholder="450000" keyboardType="numeric"
                    onBlur={onBlur} onChangeText={(s) => onChange(s === '' ? undefined : Number(s.replace(/[^0-9]/g, '')))}
                    value={value == null ? '' : String(value)} error={errors.amountInr?.message} />
                )} />
              </View>
            </View>
            <Controller control={control} name="description" render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Description" placeholder="Work summary…" multiline numberOfLines={3} onBlur={onBlur} onChangeText={onChange} value={value} error={errors.description?.message} />
            )} />
            {amount ? (
              <Text className="mb-2 text-[13px] font-bold" style={{ color: t.primary }}>
                Review: {inr(amount)} — status after submit: Pending (operator approval required)
              </Text>
            ) : null}
          </View>
          {failed ? (
            <View className="mb-3 mt-3 rounded-xl p-3" style={{ backgroundColor: '#FBE7E9' }}>
              <Text className="text-[13px] font-semibold" style={{ color: t.danger }}>{failed}</Text>
            </View>
          ) : null}
          <View className="mt-3">
            <Button title="Review & Submit" onPress={handleSubmit(submit)} loading={busy} />
          </View>
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
