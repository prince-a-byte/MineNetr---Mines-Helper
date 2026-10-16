import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react-native';
import { services } from '../../src/services/serviceProvider';
import { mockRepo } from '../../src/repositories/mockStore';
import { persistThemePref, useSessionStore } from '../../src/store/session';
import { useInvalidation, useLogout } from '../../src/hooks/queries';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppHeader, ConfirmDialog } from '../../src/components/ui/dialogs';
import { Avatar } from '../../src/components/ui/states';
import { Button } from '../../src/components/ui/Button';
import { TextField } from '../../src/components/ui/TextField';
import { ApiError } from '../../src/services/ApiError';
import type { ThemeName } from '../../src/theme/tokens';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View className="mb-3 rounded-2xl p-4" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
      <Text className="mb-2 text-[15px] font-extrabold" style={{ color: t.ink }}>{title}</Text>
      {children}
    </View>
  );
}

export default function Settings() {
  const { t, pref } = useTheme();
  const params = useLocalSearchParams<{ focus?: string }>();
  const setSession = useSessionStore((s) => s.setSession);
  const setThemePref = useSessionStore((s) => s.setThemePref);
  const invalidate = useInvalidation();
  const logout = useLogout();
  const [pwMsg, setPwMsg] = useState('');
  const [notif, setNotif] = useState({ safety: true, bills: true, documents: true });
  const [confirmLogout, setConfirmLogout] = useState(params.focus === 'Logout');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<{ current: string; next: string; confirm: string }>({
    defaultValues: { current: '', next: '', confirm: '' },
  });
  const prof = useForm<{ contactName: string; contactPhone: string; contactEmail: string; address: string }>({
    defaultValues: { contactName: '', contactPhone: '', contactEmail: '', address: '' },
  });

  async function changePw(v: { current: string; next: string; confirm: string }) {
    if (v.next !== v.confirm) {
      setPwMsg('New passwords do not match.');
      return;
    }
    try {
      await services.profile.changePassword(v.current, v.next);
      setPwMsg('Password changed (demo).');
      reset();
    } catch (e) {
      setPwMsg(e instanceof ApiError ? e.message : 'Change failed.');
    }
  }

  async function saveProfile(v: { contactName: string; contactPhone: string; contactEmail: string; address: string }) {
    await services.profile.updateCompany({
      ...(v.contactName ? { contactName: v.contactName } : {}),
      ...(v.contactPhone ? { contactPhone: v.contactPhone } : {}),
      ...(v.contactEmail ? { contactEmail: v.contactEmail } : {}),
      ...(v.address ? { address: v.address } : {}),
    });
    invalidate();
  }

  async function setTheme(p: ThemeName) {
    setThemePref(p);
    await persistThemePref(p);
  }

  async function doLogout() {
    await logout.mutateAsync();
    setSession(null);
    router.replace('/(auth)/roles');
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-4 pt-2">
          <AppHeader left={<Pressable accessibilityLabel="Back" onPress={() => router.back()}><ArrowLeft size={24} color={t.ink} /></Pressable>} right={<Avatar label="CT" size={38} />} />
          <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>Settings</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          <Block title="Edit Company Profile">
            <Controller control={prof.control} name="contactName" render={({ field }) => (
              <TextField label="Contact Person" placeholder="Full name" onChangeText={field.onChange} value={field.value} />
            )} />
            <Controller control={prof.control} name="contactPhone" render={({ field }) => (
              <TextField label="Contact Number" placeholder="10-digit mobile" keyboardType="number-pad" onChangeText={field.onChange} value={field.value} />
            )} />
            <Controller control={prof.control} name="contactEmail" render={({ field }) => (
              <TextField label="Email" placeholder="you@company.com" autoCapitalize="none" onChangeText={field.onChange} value={field.value} />
            )} />
            <Controller control={prof.control} name="address" render={({ field }) => (
              <TextField label="Address" placeholder="Company address" multiline onChangeText={field.onChange} value={field.value} />
            )} />
            <Button title="Save Profile" variant="secondary" onPress={prof.handleSubmit(saveProfile)} />
          </Block>

          <Block title="Change Password">
            <Controller control={control} name="current" rules={{ required: 'Enter the current password' }} render={({ field }) => (
              <TextField label="Current Password" required placeholder="••••••" secureTextEntry onChangeText={field.onChange} value={field.value} error={errors.current?.message} />
            )} />
            <Controller control={control} name="next" rules={{ required: 'Enter a new password', minLength: { value: 6, message: 'Use at least 6 characters' } }} render={({ field }) => (
              <TextField label="New Password" required placeholder="••••••" secureTextEntry onChangeText={field.onChange} value={field.value} error={errors.next?.message} />
            )} />
            <Controller control={control} name="confirm" rules={{ required: 'Confirm the new password' }} render={({ field }) => (
              <TextField label="Confirm Password" required placeholder="••••••" secureTextEntry onChangeText={field.onChange} value={field.value} error={errors.confirm?.message} />
            )} />
            {pwMsg ? <Text className="mb-2 text-[13px]" style={{ color: t.primary }}>{pwMsg}</Text> : null}
            <Button title="Update Password" variant="secondary" onPress={handleSubmit(changePw)} />
          </Block>

          <Block title="Notification Preferences">
            {([
              ['safety', 'Safety alerts'],
              ['bills', 'Bill decisions'],
              ['documents', 'Document verification'],
            ] as const).map(([k, label]) => (
              <View key={k} className="flex-row items-center justify-between py-2">
                <Text className="text-[14px]" style={{ color: t.ink }}>{label}</Text>
                <Switch value={notif[k]} onValueChange={async (val) => {
                  const next = { ...notif, [k]: val };
                  setNotif(next);
                  await mockRepo.ready();
                  await mockRepo.setPrefs({ notifPrefs: next });
                }} />
              </View>
            ))}
          </Block>

          <Block title="App Theme">
            <View className="flex-row gap-2">
              {(['system', 'light', 'dark'] as const).map((o) => (
                <Pressable key={o} onPress={() => setTheme(o)} className="flex-1 rounded-xl py-2.5" style={{ backgroundColor: pref === o ? t.navy : t.lightBlue }}>
                  <Text className="text-center text-[13px] font-bold capitalize" style={{ color: pref === o ? '#fff' : t.ink }}>{o}</Text>
                </Pressable>
              ))}
            </View>
          </Block>

          <Block title="Help & Support">
            <Text className="text-[13px] leading-5" style={{ color: t.secondary }}>
              MineNetr support: support@minenetr.demo · 1800-123-456 (toll-free, demo). For emergencies always follow your mine&apos;s statutory safety procedure first.
            </Text>
          </Block>

          <Block title="Terms & Privacy">
            <Text className="text-[13px] leading-5" style={{ color: t.secondary }}>
              Demo build. Fictional company and worker records are used for evaluation. Sensitive identifiers are masked on-device and never logged. Real terms apply at production rollout.
            </Text>
          </Block>

          <Button title="Logout" variant="danger" onPress={() => setConfirmLogout(true)} />
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        body="Your demo session on this device will be cleared."
        confirmLabel="Logout" danger onCancel={() => setConfirmLogout(false)}
        onConfirm={doLogout} busy={logout.isPending}
      />
    </SafeAreaView>
  );
}
