import * as SecureStore from 'expo-secure-store';
import { DEMO_ACCOUNTS, DEMO_OTP } from '../../constants/roles';
import { mockRepo } from '../../repositories/mockStore';
import type { AuthSession, Role } from '../../types/models';
import { ApiError } from '../ApiError';
import type { AuthService } from '../interfaces';
import { latency } from './util';

const TOKEN_KEY = 'minenetr.session.token';
const SESSION_KEY = 'minenetr.session.json';

async function persist(session: AuthSession, rememberMe: boolean): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  if (rememberMe) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

function sessionFor(email: string, role: Role, rememberMe: boolean): AuthSession {
  return {
    token: `demo-${role}-${Date.now()}`,
    userId: `U-${role.toUpperCase()}`,
    role,
    companyId: 'CT-2026-089',
    displayName: role === 'contractor' ? 'Shakti Infrastructure Services Pvt. Ltd.' : `${role} demo user`,
    email,
    rememberMe,
  };
}

/** Demo-only adapter. Accepts ONLY the documented demo accounts. */
export const mockAuth: AuthService = {
  async login(identifier, password, role) {
    await latency(500);
    const id = identifier.trim().toLowerCase();
    const acct = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === id || a.email.split('@')[0] === id,
    );
    if (!acct || acct.password !== password) {
      throw new ApiError('Invalid credentials. Use the documented demo account.', { status: 401 });
    }
    // Role is login-flow state; the (future) backend verifies real permissions.
    const session = sessionFor(acct.email, role, true);
    await persist(session, true);
    return session;
  },

  async loginWithOtp(identifier) {
    await latency(400);
    const id = identifier.trim();
    if (!/^[6-9]\d{9}$/.test(id) && !/.+@.+\..+/.test(id)) {
      throw new ApiError('Enter a valid mobile number or email.', { status: 422 });
    }
    return { maskedTo: id.replace(/(\d{2})\d{6}(\d{2})/, '$1XXXXXX$2') };
  },

  async verifyOtp(identifier, code, role) {
    await latency(500);
    if (code !== DEMO_OTP) throw new ApiError('Incorrect code. Hint (demo only): 123456.', { status: 401 });
    const session = sessionFor(identifier.trim(), role, true);
    await persist(session, true);
    return session;
  },

  async resendOtp() {
    await latency(300);
  },

  async requestPasswordReset(identifier) {
    await latency(400);
    if (!identifier.trim()) throw new ApiError('Enter your registered email or mobile.', { status: 422 });
    return { demoNote: 'Demo mode: no real reset message was sent. Contact your administrator to reset credentials.' };
  },

  async logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },

  async getSession() {
    const [token, raw] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(SESSION_KEY),
    ]);
    if (!token || !raw) return null;
    try {
      const s = JSON.parse(raw) as AuthSession;
      return s.token === token ? s : null;
    } catch {
      return null;
    }
  },
};

export async function restoreSession(): Promise<AuthSession | null> {
  return mockAuth.getSession();
}

export { TOKEN_KEY };
export type { Role };
export { mockRepo };
