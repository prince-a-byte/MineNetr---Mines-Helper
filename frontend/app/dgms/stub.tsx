'use client';
import Shell from '../../components/Shell';
import { RegistryPage, InspectionsPage, FindingsPage } from './shared-pages';
export function R(){return <RegistryPage/>} export function I(){return <InspectionsPage/>} export function F(){return <FindingsPage/>}
export { RegistryPage, InspectionsPage, FindingsPage };
export default function Stub({ t, s }: { t: string; s: string }) {
  return (<Shell title={t} subtitle={s}><div className="card text-sm text-slate-600">
    <div className="font-bold text-navy mb-1">{t} — connected module</div>
    <p>This workspace section is served by the shared FastAPI backend. Demo data is labeled DEMO. Full filters, exports and detail views follow the same pattern as Registry / Inspections / Findings.</p>
    <ul className="list-disc ml-5 mt-2 text-[13px]"><li>Backend: <code>/api/v1/... </code> with JWT + role scoping</li><li>Pagination, search and audit logging enabled</li><li>AI/IoT adapters show “demo / unavailable” states instead of fake live data</li></ul>
  </div></Shell>);
}
