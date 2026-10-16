import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { ArrowLeft, MailCheck } from 'lucide-react-native';
import { services } from '../../src/services/serviceProvider';
import { useTheme } from '../../src/theme/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { TextField } from '../../src/components/ui/TextField';

export default function ForgotPassword() {
  const { t } = useTheme();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<{ identifier: string }>({
    defaultValues: { identifier: '' },
  });

  async function submit(v: { identifier: string }) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await services.auth.requestPasswordReset(v.identifier);
      setNote(r.demoNote);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} className="self-start p-1">
            <ArrowLeft size={24} color={t.ink} />
          </Pressable>
          <Text className="mt-4 text-[22px] font-extrabold" style={{ color: t.ink }}>Reset password</Text>
          <Text className="mt-1 text-[13px]" style={{ color: t.secondary }}>
            Enter your registered email or mobile number.
          </Text>
          <View className="mt-5">
            <Controller
              control={control} name="identifier"
              rules={{ required: 'Enter your registered email or mobile' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField label="Email or Mobile Number" required placeholder="you@example.com"
                  autoCapitalize="none" onBlur={onBlur} onChangeText={onChange} value={value}
                  error={errors.identifier?.message} />
              )}
            />
            {note ? (
              <View className="mb-3 flex-row rounded-xl p-3" style={{ backgroundColor: t.lightBlue }}>
                <MailCheck size={18} color={t.primary} />
                <Text className="ml-2 flex-1 text-[13px]" style={{ color: t.ink }}>{note}</Text>
              </View>
            ) : null}
            <Button title="Send reset link" onPress={handleSubmit(submit)} loading={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
