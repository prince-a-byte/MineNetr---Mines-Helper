# MineNetr Contractor — Mobile App (Expo SDK 57)

Contractor workspace for the MineNetr mining ecosystem: splash with loading
animation, onboarding, 4-role selection, login + OTP + password recovery,
Home dashboard, Mines + mine details, Workers + validated creation + profiles,
Documents + upload-for-verification, Bills + submission + detail, company
Profile & Settings, notifications. Other roles land on a clear
"workspace not yet implemented" boundary screen.

## Stack (verified)

- Expo SDK **57** (`expo@57.0.30`), React Native **0.86.3**, React **19.2.3**, TypeScript **~6**
- Expo Router **v6** (`~57.0.28`), NativeWind **4.2.7** + `tailwindcss@3.4.18` (v3 required — never v4)
- react-hook-form + zod (`@hookform/resolvers`), TanStack Query v5, Zustand v5
- lucide-react-native, react-native-svg (donut charts)
- expo-secure-store (session token), AsyncStorage (demo records, prefs, theme)
- expo-image-picker (avatar/photo capture), expo-document-picker (file select)
- `npx tsc --noEmit` clean · `npx expo-doctor` **21/21 passed**
- `npx expo export --platform web` succeeds (3128 modules, all 18 image
  assets, NativeWind CSS) — proves every route resolves and bundles
- `npm run smoke` — **24 checks passed**: login/OTP/reset honesty, worker
  CRUD + transfer + status, doc upload stays Pending, bill lifecycle with
  dashboard-total consistency, profile edit, notifications

## Run it

```powershell
cd Application
npm install
npx expo start            # scan QR with Expo Go (SDK 57 build) or a dev build
npx expo start --web      # browser smoke test
npx expo start --android  # emulator / device
```

Copy `.env.example` to `.env` if you change data mode or API URL (defaults work
for demo: `EXPO_PUBLIC_DATA_MODE=mock`).

## Demo mode (default, no backend needed)

The app boots straight into demo. A `DEMO` badge is shown on the login screen.
Demo records are fictional (Shakti Infrastructure Services, WK001…).

| Role | Email | Password |
|---|---|---|
| Contractor (fully built) | `contractor@minenetr.demo` | `Demo@123` |
| DGMS / Inspector / Operator | `dgms@…` / `inspector@…` / `operator@…` + `Demo@123` | authenticates, then shows the *unavailable-workspace* boundary |

OTP login: any valid mobile/email → code **`123456`** (dev only, shown on the
screen in `__DEV__`; no real SMS is ever sent). Resend cooldown: 30 s.

Try: add a worker → appears in Workers + Home counts; submit a bill →
Pending in Bills + totals update; upload a document → Pending (never
auto-verified); transfer Ramesh Yadav → mine counts follow.

## Switching to the real backend later

1. Confirm each endpoint against the FastAPI OpenAPI docs — see
   `docs/API_CONTRACT_TODO.md` (proposed map; nothing is assumed to exist).
2. Implement the `Services` interface in `src/services/http/*`.
3. Set `EXPO_PUBLIC_DATA_MODE=http` and a reachable `EXPO_PUBLIC_API_BASE_URL`
   (Android emulator `http://10.0.2.2:8000`, device = dev-machine LAN IP —
   never bare `localhost` on a phone).
4. HTTP mode **never** falls back to mock data; failures surface as errors.

Screens only ever import `services` from `src/services/serviceProvider` —
no UI changes are needed for the switch.

## Layout

- `app/` — expo-router routes: `index` (splash+loading bar), `onboarding`,
  `(auth)` (roles/login/verify-otp/forgot-password), `(contractor)` (5 tabs +
  detail stacks), `(other-roles)/unavailable`
- `src/theme` — navy/blue tokens + light/dark/system theme
- `src/types` — typed domain models (amounts stored numeric INR, never formatted)
- `src/schemas` — zod input validation
- `src/repositories/mockStore.ts` — single mock source of truth + persistence
- `src/services/{interfaces,mock,http}` — swappable adapters
- `src/components/ui` — Button/Card/Chip/fields/sheets/dialogs/donut/states
- `assets/images` — mining photos + worker avatars cropped from the reference PDF

## Remaining TODOs

- Device/emulator run-through (validated via typecheck, doctor, web export)
- `expo-notifications` + email/SMS provider wiring for real OTP/alerts
- Server-backed file upload (multipart) + operator verification actions
- EAS Build profiles for store submission
