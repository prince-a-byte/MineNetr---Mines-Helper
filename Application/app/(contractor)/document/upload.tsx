import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, FileUp, X } from 'lucide-react-native';
import { DOC_TYPES } from '../../../src/constants/roles';
import { documentSchema, type DocumentInput } from '../../../src/schemas/forms';
import { services } from '../../../src/services/serviceProvider';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useInvalidation } from '../../../src/hooks/queries';
import { fileSize } from '../../../src/utils/format';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar } from '../../../src/components/ui/states';
import { Button } from '../../../src/components/ui/Button';
import { SelectSheet } from '../../../src/components/ui/SelectSheet';
import { TextField } from '../../../src/components/ui/TextField';
import { validateFile } from '../../../src/services/mock/documents.mock';
import { ApiError } from '../../../src/services/ApiError';

export default function UploadDocument() {
  const { t } = useTheme();
  const invalidate = useInvalidation();
  const params = useLocalSearchParams<{ workerId?: string }>();
  const [scope, setScope] = useState<'worker' | 'company'>('worker');
  const [workerId, setWorkerId] = useState(params.workerId ?? 'WK001');
  const [file, setFile] = useState<{ name: string; size?: number; uri: string } | null>(null);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const mines = mockRepo.mines();
  const workers = mockRepo.data.workers;
  const worker = workers.find((w) => w.id === workerId);

  const { control, handleSubmit, formState: { errors } } = useForm<DocumentInput>({
    resolver: zodResolver(documentSchema),
    defaultValues: { type: 'Medical Certificate', mineId: worker?.mineId ?? 'm1', issueDate: '2025-01-12', expiryDate: '2026-01-12' },
  });

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0]!;
    try {
      validateFile(a.name, a.size);
      setFile({ name: a.name, size: a.size, uri: a.uri });
      setFailed('');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Invalid file.');
    }
  }
  async function capturePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setFailed('Camera permission is required to capture evidence.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (res.canceled) return;
    const a = res.assets[0]!;
    setFile({ name: a.fileName ?? `photo-${Date.now()}.jpg`, size: undefined, uri: a.uri });
  }

  async function submit(v: DocumentInput) {
    if (busy) return;
    if (!file) {
      setFailed('Select a file first.');
      return;
    }
    setBusy(true);
    setFailed('');
    try {
      await services.documents.createDocumentMetadata({
        ...v,
        workerId: scope === 'worker' ? workerId : undefined,
        fileName: file.name,
        fileSize: file.size,
      });
      invalidate();
      router.back();
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-4 pt-2">
          <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
          <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>Upload Document</Text>
          <Text className="text-[12px]" style={{ color: t.secondary }}>Upload and submit documents for verification</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <View className="mb-3 flex-row gap-2">
            {(['worker', 'company'] as const).map((s) => (
              <Pressable key={s} onPress={() => setScope(s)} className="flex-1 rounded-xl py-2.5" style={{ backgroundColor: scope === s ? t.navy : t.lightBlue }}>
                <Text className="text-center text-[13px] font-bold" style={{ color: scope === s ? '#fff' : t.ink }}>
                  {s === 'worker' ? 'Worker Document' : 'Company Document'}
                </Text>
              </Pressable>
            ))}
          </View>

          {scope === 'worker' ? (
            <View className="mb-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
              <Text className="mb-2 text-[15px] font-extrabold" style={{ color: t.ink }}>Worker Details</Text>
              <SelectSheet label="Worker" placeholder="Select worker" value={worker ? `${worker.name} (${worker.id})` : undefined}
                options={workers.map((w) => `${w.name} (${w.id})`)}
                onPick={(label) => setWorkerId(workers.find((w) => `${w.name} (${w.id})` === label)?.id ?? workerId)} />
              {worker ? (
                <Text className="text-[12px]" style={{ color: t.secondary }}>
                  {worker.role} · {mines.find((m) => m.id === worker.mineId)?.name}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="mb-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
            <Text className="mb-2 text-[15px] font-extrabold" style={{ color: t.ink }}>Document Information</Text>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller control={control} name="type" render={({ field: { onChange, value } }) => (
                  <SelectSheet label="Document Type" required placeholder="Select type" value={value} options={DOC_TYPES} onPick={onChange} error={errors.type?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="mineId" render={({ field: { onChange, value } }) => (
                  <SelectSheet label="Related Mine" required placeholder="Select mine"
                    value={mines.find((m) => m.id === value)?.name}
                    options={mines.map((m) => m.name)}
                    onPick={(n) => onChange(mines.find((m) => m.name === n)?.id ?? '')} error={errors.mineId?.message} />
                )} />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Controller control={control} name="issueDate" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Issue Date" required placeholder="YYYY-MM-DD" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.issueDate?.message} />
                )} />
              </View>
              <View className="flex-1">
                <Controller control={control} name="expiryDate" render={({ field: { onChange, onBlur, value } }) => (
                  <TextField label="Expiry Date" required placeholder="YYYY-MM-DD" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.expiryDate?.message} />
                )} />
              </View>
            </View>
            <Controller control={control} name="docNumber" render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Document Number (Optional)" placeholder="Enter document number" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.docNumber?.message} />
            )} />
          </View>

          <View className="mb-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
            <Text className="mb-2 text-[15px] font-extrabold" style={{ color: t.ink }}>Upload File</Text>
            {file ? (
              <View className="flex-row items-center rounded-xl border border-dashed p-3" style={{ borderColor: t.divider }}>
                <FileUp size={22} color={t.primary} />
                <View className="ml-2 flex-1">
                  <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{file.name}</Text>
                  <Text className="text-[11px]" style={{ color: t.success }}>{fileSize(file.size)} · File Selected (Pending verification)</Text>
                </View>
                <Pressable accessibilityLabel="Remove file" onPress={() => setFile(null)} className="p-1">
                  <X size={18} color={t.secondary} />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <Pressable accessibilityRole="button" onPress={pickFile} className="flex-1 items-center rounded-xl border border-dashed py-5" style={{ borderColor: t.divider }}>
                  <FileUp size={26} color={t.primary} />
                  <Text className="mt-1 text-[13px] font-bold" style={{ color: t.primary }}>Choose File</Text>
                  <Text className="mt-0.5 px-2 text-center text-[11px]" style={{ color: t.secondary }}>PDF, JPG, PNG (Max 5 MB)</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={capturePhoto} className="flex-1 items-center rounded-xl border border-dashed py-5" style={{ borderColor: t.divider }}>
                  <Camera size={26} color={t.primary} />
                  <Text className="mt-1 text-[13px] font-bold" style={{ color: t.primary }}>Take Photo</Text>
                  <Text className="mt-0.5 px-2 text-center text-[11px]" style={{ color: t.secondary }}>Capture with camera</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View className="mb-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
            <Controller control={control} name="remarks" render={({ field: { onChange, onBlur, value } }) => (
              <TextField label="Remarks (Optional)" placeholder="Enter any remarks…" multiline numberOfLines={3} onBlur={onBlur} onChangeText={onChange} value={value} error={errors.remarks?.message} />
            )} />
          </View>

          {failed ? (
            <View className="mb-3 rounded-xl p-3" style={{ backgroundColor: '#FBE7E9' }}>
              <Text className="text-[13px] font-semibold" style={{ color: t.danger }}>{failed}</Text>
            </View>
          ) : null}
          <Button title="Submit for Verification" onPress={handleSubmit(submit)} loading={busy} />
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
