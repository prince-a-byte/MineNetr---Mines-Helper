import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Pencil } from 'lucide-react-native';
import { useCompany } from '../../../src/hooks/queries';
import { fmtDate } from '../../../src/utils/format';
import { mockRepo } from '../../../src/repositories/mockStore';
import { useTheme } from '../../../src/theme/ThemeContext';
import { AppHeader } from '../../../src/components/ui/dialogs';
import { Avatar } from '../../../src/components/ui/states';
import { Card } from '../../../src/components/ui/Card';
import { Chip } from '../../../src/components/ui/Chip';

const SETTINGS = [
  ['Change Password', '/(contractor)/settings#password'],
  ['Notification Preferences', '/(contractor)/settings#prefs'],
  ['App Theme', '/(contractor)/settings#theme'],
  ['Help & Support', '/(contractor)/settings#help'],
  ['Terms & Privacy', '/(contractor)/settings#terms'],
  ['Logout', '/(contractor)/settings#logout'],
] as const;

export default function More() {
  const { t } = useTheme();
  const company = useCompany();
  const c = company.data;
  const mines = c ? c.mineIds.map((id) => mockRepo.mineById(id)!).filter(Boolean) : [];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: t.appBg }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <AppHeader left={<Menu size={24} color={t.ink} />} right={<Avatar label="CT" size={38} />} />
        <Text className="mt-1 text-[24px] font-extrabold" style={{ color: t.ink }}>Profile & Settings</Text>
        <Text className="text-[12px]" style={{ color: t.secondary }}>Manage your company profile, settings and preferences</Text>

        <View className="mt-3 overflow-hidden rounded-2xl" style={{ borderWidth: 1, borderColor: t.divider }}>
          <Image source={require('../../../assets/images/profile-banner.jpg')} className="h-36 w-full" resizeMode="cover" />
          <View className="p-4" style={{ backgroundColor: t.surface }}>
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-[17px] font-extrabold" style={{ color: t.ink }}>{c?.name}</Text>
              <Link href="/(contractor)/settings" asChild>
                <Pressable className="flex-row items-center rounded-lg px-2.5 py-1.5" style={{ backgroundColor: t.lightBlue }}>
                  <Pencil size={13} color={t.primary} />
                  <Text className="ml-1 text-[12px] font-bold" style={{ color: t.primary }}>Edit Profile</Text>
                </Pressable>
              </Link>
            </View>
            <View className="mt-1 flex-row items-center gap-2">
              <Text className="text-[12px]" style={{ color: t.secondary }}>Contractor ID: {c?.contractorId}</Text>
              {c ? <Chip label={c.status} /> : null}
            </View>
            <Text className="mt-1 text-[12px]" style={{ color: t.secondary }}>
              Registered with DGMS · Valid till: {c ? fmtDate(c.dgmsValidTill) : ''}
            </Text>
          </View>
        </View>

        <Text className="mb-2 mt-4 text-[16px] font-extrabold" style={{ color: t.ink }}>Company Information</Text>
        <Card>
          {[
            ['Company Name', c?.name ?? ''],
            ['Registration Number', c?.registration ?? ''],
            ['GST Number', c?.gstin ?? ''],
            ['Address', c?.address ?? ''],
          ].map(([k, val]) => (
            <View key={k as string} className="flex-row justify-between gap-3 py-2" style={{ borderBottomWidth: 1, borderColor: t.divider }}>
              <Text className="text-[13px]" style={{ color: t.secondary }}>{k}</Text>
              <Text className="flex-1 text-right text-[13px] font-semibold" style={{ color: t.ink }}>{val}</Text>
            </View>
          ))}
          <Text className="mb-1 mt-3 text-[15px] font-extrabold" style={{ color: t.ink }}>Contact Person</Text>
          {[
            ['Name', c?.contactName ?? ''],
            ['Designation', c?.contactDesignation ?? ''],
            ['Contact Number', c?.contactPhone ? `+${c.contactPhone}` : ''],
            ['Email ID', c?.contactEmail ?? ''],
          ].map(([k, val]) => (
            <View key={k as string} className="flex-row justify-between gap-3 py-2" style={{ borderBottomWidth: 1, borderColor: t.divider }}>
              <Text className="text-[13px]" style={{ color: t.secondary }}>{k}</Text>
              <Text className="flex-1 text-right text-[13px] font-semibold" style={{ color: t.ink }}>{val}</Text>
            </View>
          ))}
        </Card>

        <Text className="mb-2 mt-4 text-[16px] font-extrabold" style={{ color: t.ink }}>Assigned Mines</Text>
        <Card padded={false}>
          {mines.map((m, i) => (
            <View key={m.id} className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: i < mines.length - 1 ? 1 : 0, borderColor: t.divider }}>
              <Image source={m.image} style={{ width: 52, height: 52, borderRadius: 10 }} />
              <View className="ml-3 flex-1">
                <Text className="text-[13px] font-bold" style={{ color: t.ink }}>{m.name}</Text>
                <Text className="text-[11px]" style={{ color: t.secondary }}>{m.location}</Text>
              </View>
              <Chip label={m.status} />
            </View>
          ))}
        </Card>

        <Text className="mb-2 mt-4 text-[16px] font-extrabold" style={{ color: t.ink }}>Settings</Text>
        <Card padded={false}>
          {SETTINGS.map(([label], i) => (
            <Link key={label} href={{ pathname: '/(contractor)/settings', params: { focus: label } }} asChild>
              <Pressable className="flex-row items-center px-4 py-3.5" style={{ borderBottomWidth: i < SETTINGS.length - 1 ? 1 : 0, borderColor: t.divider }}>
                <Text className="flex-1 text-[14px] font-semibold" style={{ color: label === 'Logout' ? t.danger : t.ink }}>{label}</Text>
                <Text style={{ color: t.secondary }}>›</Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
