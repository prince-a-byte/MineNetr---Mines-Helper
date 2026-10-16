import { create } from 'zustand';
import type { AuthSession, Role } from '../types/models';
import type { ThemeName } from '../theme/tokens';
import { mockRepo } from '../repositories/mockStore';

interface SessionState {
  session: AuthSession | null;
  selectedRole: Role;
  themePref: ThemeName;
  hydrated: boolean;
  setSession: (s: AuthSession | null) => void;
  setRole: (r: Role) => void;
  setThemePref: (t: ThemeName) => void;
  hydrateTheme: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  selectedRole: 'contractor',
  themePref: 'system',
  hydrated: false,
  setSession: (session) => set({ session }),
  setRole: (selectedRole) => set({ selectedRole }),
  setThemePref: (themePref) => set({ themePref }),
  hydrateTheme: async () => {
    try {
      await mockRepo.ready();
      const saved = await import('@react-native-async-storage/async-storage').then(
        (m) => m.default.getItem('@minenetr/theme'),
      );
      set({
        themePref: saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system',
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));

export async function persistThemePref(t: ThemeName): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem('@minenetr/theme', t);
}
