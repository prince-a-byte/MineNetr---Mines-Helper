import { Image, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from './Button';

export function EmptyState({ title, sub, actionLabel, onAction }: { title: string; sub?: string; actionLabel?: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <View className="items-center rounded-2xl border border-dashed px-6 py-10" style={{ borderColor: t.divider }}>
      <Text className="text-[15px] font-bold" style={{ color: t.ink }}>{title}</Text>
      {sub ? <Text className="mt-1 text-center text-[13px]" style={{ color: t.secondary }}>{sub}</Text> : null}
      {actionLabel && onAction ? (
        <View className="mt-4"><Button title={actionLabel} onPress={onAction} variant="secondary" /></View>
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTheme();
  return (
    <View className="items-center rounded-2xl px-6 py-10" style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}>
      <Text className="text-center text-[14px] font-semibold" style={{ color: t.danger }}>{message}</Text>
      {onRetry ? <View className="mt-4"><Button title="Retry" onPress={onRetry} variant="secondary" /></View> : null}
    </View>
  );
}

export function Avatar({ source, size = 56, label }: { source?: number | string; size?: number; label?: string }) {
  const { t } = useTheme();
  if (source) {
    const src = typeof source === 'string' ? { uri: source } : source;
    return <Image source={src} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.divider }} />;
  }
  return (
    <View className="items-center justify-center" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.navy }}>
      <Text className="font-bold text-white" style={{ fontSize: size * 0.36 }}>{label ?? '?'}</Text>
    </View>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-[17px] font-extrabold" style={{ color: t.ink }}>{title}</Text>
      {actionLabel && onAction ? (
        <Text onPress={onAction} className="text-[13px] font-bold" style={{ color: t.primary }}>{actionLabel}</Text>
      ) : null}
    </View>
  );
}

export function DemoBadge() {
  return (
    <View className="rounded-full bg-amber-100 px-2.5 py-1">
      <Text className="text-[10px] font-extrabold tracking-wide text-amber-800">DEMO</Text>
    </View>
  );
}
