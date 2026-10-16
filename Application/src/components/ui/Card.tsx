import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function Card({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  const { t } = useTheme();
  return (
    <View
      className={`rounded-2xl ${padded ? 'p-4' : ''}`}
      style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.divider }}
    >
      {children}
    </View>
  );
}
