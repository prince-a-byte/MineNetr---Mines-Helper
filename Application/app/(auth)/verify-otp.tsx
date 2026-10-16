import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { DEMO_OTP, OTP_RESEND_SECONDS } from '../../src/constants/roles';
import { services, isDemo } from '../../src/services/serviceProvider';
import { useSessionStore } from '../../src/store/session';
import { useTheme } from '../../src/theme/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { DemoBadge } from '../../src/components/ui/states';
import { ApiError } from '../../src/services/ApiError';

export default function VerifyOtp() {
  const { t } = useTheme();
  const role = useSessionStore((s) => s.selectedRole);
  const setSession = useSessionStore((s) => s.setSession);
  const params = useLocalSearchParams<{ to?: string }>();
  const id = params.to ?? '';
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const [cool, setCool] = useState(OTP_RESEND_SECONDS);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (cool <= 0) return;
    const timer = setInterval(() => setCool((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cool]);

  function setDigit(i: number, v: string) {
    // Paste support: distribute multi-char input across boxes.
    if (v.length > 1) {
      const chars = v.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...digits];
      chars.forEach((c, k) => { if (i + k < 6) next[i + k] = c; });
      setDigits(next);
      const focus = Math.min(i + chars.length, 5);
      refs.current[focus]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = v.replace(/\D/g, '');
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  }
  function backspace(i: number) {
    if (!digits[i] && i > 0) {
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
      refs.current[i - 1]?.focus();
    }
  }

  async function verify() {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try {
      const session = await services.auth.verifyOtp(id, digits.join(''), role);
      setSession(session);
      if (session.role === 'contractor') router.replace('/(contractor)/(tabs)');
      else router.replace('/(other-roles)/unavailable');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (cool > 0) return;
    await services.auth.resendOtp(id);
    setCool(OTP_RESEND_SECONDS);
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
          <View className="flex-row items-center justify-between">
            <Pressable accessibilityLabel="Back" onPress={() => router.back()} className="p-1">
              <ArrowLeft size={24} color={t.ink} />
            </Pressable>
            {isDemo ? <DemoBadge /> : null}
          </View>
          <View className="mt-4 items-center">
            <Text className="text-[22px] font-extrabold" style={{ color: t.ink }}>Verify OTP</Text>
            <Text className="mt-1 text-center text-[13px]" style={{ color: t.secondary }}>
              Code sent to {id || 'your device'}. Demo build: no real SMS is sent.
            </Text>
            {__DEV__ ? (
              <Text className="mt-1 text-[12px] font-bold" style={{ color: t.primary }}>Demo code: {DEMO_OTP}</Text>
            ) : null}
          </View>
          <View className="mt-6 flex-row justify-between">
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                className="h-14 w-12 rounded-xl border text-center text-[20px] font-extrabold"
                style={{ borderColor: failed ? t.danger : d ? t.primary : t.divider, backgroundColor: t.surface, color: t.ink }}
                keyboardType="number-pad"
                maxLength={i === 0 ? 6 : 1}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace') backspace(i); }}
                accessibilityLabel={`Digit ${i + 1}`}
              />
            ))}
          </View>
          {failed ? <Text className="mt-3 text-center text-[13px]" style={{ color: t.danger }}>{failed}</Text> : null}
          <View className="mt-6">
            <Button title="Verify" onPress={verify} loading={busy} />
          </View>
          <View className="mt-4 flex-row items-center justify-center">
            <Text className="text-[13px]" style={{ color: t.secondary }}>Didn&apos;t receive it? </Text>
            <Pressable onPress={resend} disabled={cool > 0}>
              <Text className="text-[13px] font-bold" style={{ color: cool > 0 ? t.secondary : t.primary }}>
                {cool > 0 ? `Resend in ${cool}s` : 'Resend'}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={() => router.back()} className="mt-2 items-center">
            <Text className="text-[13px] font-bold" style={{ color: t.primary }}>Change mobile number</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
