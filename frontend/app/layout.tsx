import './globals.css';
export const metadata = { title: 'MineNetr — Safer Mines. Smarter Governance.', description: 'Unified mine safety, operations & regulatory monitoring platform' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
