import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera } from 'lucide-react-native';
import { JOB_ROLES } from '../../../src/constants/roles';
import { workerSchema, type WorkerInput } from '../../../src/schemas/forms';
import { services } from '../../../src/services/serviceProvider';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useInvalidation } from '../../../src/hooks/queries';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar } from '../../../src/components/ui/states';
import { Button } from '../../../src/components/ui/Button';
import { SelectSheet } from '../../../src/components/ui/SelectSheet';
import { TextField } from '../../../src/components/ui/TextField';
import { ApiError } from '../../../src/services/ApiError';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View className="mb-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
      <Text className="mb-3 text-[15px] font-extrabold" style={{ color: t.ink }}>{title}</Text>
      {children}
    </View>
  );
}

export default function NewWorker() {
  const { t } = useTheme();
  const invalidate = useInvalidation();
  const [photo, setPhoto] = useState<string | undefined>();
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const mines = mockRepo.mines();
  const mineNames = mines.map((m) => m.name);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<WorkerInput>({
    resolver: zodResolver(workerSchema),
    defaultValues: { gender: 'Male', employmentType: 'Contract', remarks: '' },
  });
  const mineName = watch('mineId');
  const chosenMine = mines.find((m) => m.id === mineName);

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled) setPhoto(res.assets[0]?.uri);
  }

  async function submit(v: WorkerInput) {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try {
      const w = await services.workers.createWorker(v);
      invalidate();
      router.replace({ pathname: '/(contractor)/worker/[id]', params: { id: w.id } });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Could not save the worker.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-4 pt-2">
          <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
          <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>Add New Worker</Text>
          <Text className="text-[12px]" style={{ color: t.secondary }}>Enter worker details and assign to a mine</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <Section title="Personal Information">
            <View className="mb-3 flex-row items-center">
              <Pressable accessibilityLabel="Choose photo" onPress={pickPhoto} className="relative">
                {photo
                  ? <Image source={{ uri: photo }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                  : <Avatar label="?" size={72} />}
                <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: t.navy }}>
                  <Camera size={14} color="#fff" />
                </View>
              </Pressable>
              <View className="ml-3 flex-1">
                <Controller control={control} name="fullName" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Full Name" required placeholder="Enter full name" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.fullName?.message} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller control={control} name="aadhaar" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Aadhaar Number" required placeholder="12-digit number" keyboardType="number-pad" maxLength={12} onBlur={onBlur} onChangeText={onChange} value={value} error={errors.aadhaar?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="dob" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Date of Birth" required placeholder="YYYY-MM-DD" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.dob?.message} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller control={control} name="gender" render={({ field: { onChange, value } }) => (
                  <SelectSheet label="Gender" required placeholder="Select gender" value={value} options={['Male', 'Female', 'Other']} onPick={onChange} error={errors.gender?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="phone" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Contact Number" required placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} onBlur={onBlur} onChangeText={onChange} value={value} error={errors.phone?.message} />
                )} />
              </View>
            </View>
          </Section>

          <Section title="Work Assignment">
            <Controller control={control} name="mineId" render={({ field: { onChange } }) => (
              <SelectSheet label="Assign to Mine" required placeholder="Select mine" value={chosenMine?.name} options={mineNames} onPick={(n) => onChange(mines.find((m) => m.name === n)?.id ?? '')} error={errors.mineId?.message} />
            )} />
            <Controller control={control} name="jobRole" render={({ field: { onChange, value } }) => (
              <SelectSheet label="Job Role / Designation" required placeholder="Select role" value={value} options={JOB_ROLES} onPick={onChange} error={errors.jobRole?.message} />
            )} />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller control={control} name="joiningDate" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Date of Joining" required placeholder="YYYY-MM-DD" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.joiningDate?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="employmentType" render={({ field: { onChange, value } }) => (
                  <SelectSheet label="Employment Type" required placeholder="Select type" value={value} options={['Contract', 'Full-time', 'Daily Wage']} onPick={onChange} error={errors.employmentType?.message} />
                )} />
              </View>
            </View>
          </Section>

          <Section title="Remarks (Optional)">
            <Controller control={control} name="remarks" render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="" placeholder="Enter any additional information…" multiline numberOfLines={3} onBlur={onBlur} onChangeText={onChange} value={value} error={errors.remarks?.message} />
            )} />
          </Section>

          {failed ? (
            <View className="mb-3 rounded-xl p-3" style={{ backgroundColor: '#FBE7E9' }}>
              <Text className="text-[13px] font-semibold" style={{ color: t.danger }}>{failed}</Text>
            </View>
          ) : null}
          <Button title="Submit" onPress={handleSubmit(submit)} loading={busy} />
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
