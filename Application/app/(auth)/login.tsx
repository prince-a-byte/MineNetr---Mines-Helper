import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { Images } from '../../src/constants/images';
import { DEMO_ACCOUNTS, ROLES } from '../../src/constants/roles';
import { loginSchema, type LoginInput } from '../../src/schemas/forms';
import { services, isDemo } from '../../src/services/serviceProvider';
import { useSessionStore } from '../../src/store/session';
import { useTheme } from '../../src/theme/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { PasswordField, TextField } from '../../src/components/ui/TextField';
import { DemoBadge } from '../../src/components/ui/states';
import { ApiError } from '../../src/services/ApiError';

export default function Login() {
  const { t } = useTheme();
  const role = useSessionStore((s) => s.selectedRole);
  const setSession = useSessionStore((s) => s.setSession);
  const [failed, setFailed] = useState('');
  const [busy, setBusy] = useState(false);
  const roleMeta = ROLES.find((r) => r.id === role)!;
  const demo = DEMO_ACCOUNTS.find((a) => a.role === role)!;

  const { control, handleSubmit, setValue, watch, getValues, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: __DEV__ ? demo.email : '', password: __DEV__ ? demo.password : '', rememberMe: true },
  });
  const rememberMe = watch('rememberMe');
  const [otpBusy, setOtpBusy] = useState(false);

  async function otpLogin() {
    if (otpBusy) return;
    setOtpBusy(true);
    setFailed('');
    try {
      const id = getValues('identifier').trim();
      if (!id) {
        setFailed('Enter your email or mobile number first.');
        return;
      }
      await services.auth.loginWithOtp(id);
      router.push({ pathname: '/(auth)/verify-otp', params: { to: id } });
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Could not start OTP login.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function submit(v: LoginInput) {
    if (busy) return;
    setBusy(true);
    setFailed('');
    try {
      const session = await services.auth.login(v.identifier, v.password, role);
      // Honor "remember me": session-only logins are kept in memory.
      if (!v.rememberMe) setSession({ ...session, rememberMe: false });
      else setSession(session);
      if (session.role === 'contractor') router.replace('/(contractor)/(tabs)');
      else router.replace('/(other-roles)/unavailable');
    } catch (e) {
      setFailed(e instanceof ApiError ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 8 }}>
          <View className="flex-row items-center justify-between">
            <Pressable accessibilityLabel="Back to role selection" onPress={() => router.back()} className="p-1">
              <ArrowLeft size={24} color={t.ink} />
            </Pressable>
            {isDemo ? <DemoBadge /> : null}
          </View>
          <View className="mt-1 items-center">
            <View className="flex-row items-baseline">
              <Text className="text-[34px] font-extrabold tracking-tight" style={{ color: t.navy }}>Mine</Text>
              <Text className="text-[34px] font-extrabold tracking-tight" style={{ color: t.primary }}>Netr</Text>
            </View>
            <View className="mt-2 flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: t.lightBlue }}>
              <Text className="text-[12px] font-bold" style={{ color: t.primary }}>{roleMeta.title}</Text>
              <Link href="/(auth)/roles" asChild>
                <Text className="ml-1.5 text-[12px] font-bold underline" style={{ color: t.primary }}>Change</Text>
              </Link>
            </View>
            <Text className="mt-3 text-[20px] font-extrabold" style={{ color: t.ink }}>Contractor Login</Text>
            <Text className="mt-1 text-[13px]" style={{ color: t.secondary }}>Access your projects, workforce and documents.</Text>
          </View>

          <View className="mt-5">
            <Controller
              control={control} name="identifier"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField label="Email or Mobile Number" required placeholder="contractor@example.com"
                  autoCapitalize="none" keyboardType="email-address" onBlur={onBlur} onChangeText={onChange}
                  value={value} error={errors.identifier?.message} />
              )}
            />
            <Controller
              control={control} name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordField label="Password" required placeholder="Enter your password"
                  onBlur={onBlur} onChangeText={onChange} value={value} error={errors.password?.message} />
              )}
            />
            <View className="mb-4 flex-row items-center justify-between">
              <Pressable accessibilityRole="checkbox" accessibilityLabel="Remember me" onPress={() => setValue('rememberMe', !rememberMe)} className="flex-row items-center">
                <View className="mr-2 h-5 w-5 items-center justify-center rounded-md border" style={{ borderColor: t.primary, backgroundColor: rememberMe ? t.primary : 'transparent' }}>
                  {rememberMe ? <Text className="text-[12px] font-bold text-white">✓</Text> : null}
                </View>
                <Text className="text-[13px]" style={{ color: t.ink }}>Remember Me</Text>
              </Pressable>
              <Link href="/(auth)/forgot-password" asChild>
                <Text className="text-[13px] font-bold" style={{ color: t.primary }}>Forgot Password?</Text>
              </Link>
            </View>
            {failed ? (
              <View className="mb-3 rounded-xl p-3" style={{ backgroundColor: '#FBE7E9' }}>
                <Text className="text-[13px] font-semibold" style={{ color: t.danger }}>{failed}</Text>
              </View>
            ) : null}
            <Button title="Login" onPress={handleSubmit(submit)} loading={busy} />
            <View className="my-4 flex-row items-center">
              <View className="h-px flex-1" style={{ backgroundColor: t.divider }} />
              <Text className="mx-3 text-[12px]" style={{ color: t.secondary }}>OR</Text>
              <View className="h-px flex-1" style={{ backgroundColor: t.divider }} />
            </View>
            <Button title="Login with OTP" variant="secondary" onPress={otpLogin} loading={otpBusy} />
            {__DEV__ ? (
              <Text className="mt-3 text-center text-[11px]" style={{ color: t.secondary }}>
                Demo (dev only): {demo.email} / {demo.password}
              </Text>
            ) : null}
          </View>
        </ScrollView>
        <Image source={Images.loginArt} className="h-36 w-full" resizeMode="cover" />
        <View className="flex-row items-center px-5 py-3" style={{ backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.divider }}>
          <ShieldCheck size={18} color={t.success} />
          <View className="ml-2 flex-1">
            <Text className="text-[12px] font-bold" style={{ color: t.ink }}>Secure Access</Text>
            <Text className="text-[11px]" style={{ color: t.secondary }}>Your data is protected and encrypted</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
