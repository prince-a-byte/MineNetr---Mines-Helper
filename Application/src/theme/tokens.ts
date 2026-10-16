/** Centralized MineNetr mobile design tokens (from contractor PDF reference). */
export const palette = {
  navy: '#0B3154',
  primary: '#1463D9',
  lightBlue: '#EAF3FF',
  appBg: '#F4F7FB',
  surface: '#FFFFFF',
  ink: '#14253B',
  secondary: '#68788D',
  success: '#159B72',
  warning: '#E8A02B',
  danger: '#DC4C58',
  divider: '#E1E8F0',
} as const;

export const darkPalette: Record<keyof typeof palette, string> = {
  navy: '#0B3154',
  primary: '#3B82F6',
  lightBlue: '#16283F',
  appBg: '#0D1521',
  surface: '#16202F',
  ink: '#EAF1F8',
  secondary: '#93A3B8',
  success: '#22B68A',
  warning: '#E8A02B',
  danger: '#E4697A',
  divider: '#263445',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 8, md: 12, card: 16, pill: 999 } as const;
export const type = {
  hero: 30,
  title: 24,
  section: 17,
  body: 14,
  small: 12,
  tiny: 11,
} as const;

export type ThemeName = 'system' | 'light' | 'dark';
