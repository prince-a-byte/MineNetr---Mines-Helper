import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, palette, ThemeName } from './tokens';
import { useSessionStore } from '../store/session';

type Theme = Record<keyof typeof palette, string>;

const ThemeCtx = createContext<{ t: Theme; mode: 'light' | 'dark'; pref: ThemeName }>({
  t: palette,
  mode: 'light',
  pref: 'system',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = useSessionStore((s) => s.themePref);
  const system = useColorScheme();
  const mode: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const t = useMemo(() => (mode === 'dark' ? darkPalette : palette), [mode]);
  const value = useMemo(() => ({ t, mode, pref }), [t, mode, pref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
