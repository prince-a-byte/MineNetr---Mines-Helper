import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function Button({
  title, onPress, variant = 'primary', loading, disabled, icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const { t } = useTheme();
  const bg = variant === 'primary' ? t.navy : variant === 'danger' ? t.danger : variant === 'secondary' ? t.lightBlue : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : variant === 'secondary' ? t.primary : t.primary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={off}
      className="flex-row items-center justify-center rounded-2xl px-5 py-4"
      style={{ backgroundColor: bg, opacity: off ? 0.6 : 1, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: t.divider }}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon}
          <Text className="text-[15px] font-bold" style={{ color: fg }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
