import type { ReactNode } from 'react';
import { Modal, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from './Button';

export function ConfirmDialog({
  visible, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel, busy,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/45 px-8">
        <View className="w-full rounded-2xl p-5" style={{ backgroundColor: t.surface }}>
          <Text className="text-[16px] font-extrabold" style={{ color: t.ink }}>{title}</Text>
          <Text className="mt-1.5 text-[14px] leading-5" style={{ color: t.secondary }}>{body}</Text>
          <View className="mt-4 flex-row gap-2">
            <View className="flex-1"><Button title="Cancel" variant="ghost" onPress={onCancel} /></View>
            <View className="flex-1"><Button title={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} loading={busy} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Reusable app header: back/menu slot, centered wordmark, avatar slot. */
export function AppHeader({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-1 py-2">
      <View className="w-12">{left}</View>
      <View className="flex-row items-baseline">
        <Text className="text-[26px] font-extrabold tracking-tight text-[#0B3154]">Mine</Text>
        <Text className="text-[26px] font-extrabold tracking-tight text-[#1463D9]">Netr</Text>
      </View>
      <View className="w-12 items-end">{right}</View>
    </View>
  );
}
