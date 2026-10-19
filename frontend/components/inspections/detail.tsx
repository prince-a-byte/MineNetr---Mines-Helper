/**
 * Individual inspection workflow — the page an inspector actually works in
 * (reference page 3). One shared inspection record drives every view here.
 *
 * Layout: back link + header meta, a 4-step workflow stepper (Pre-Inspection →
 * On-Site Verification → Evidence & Observations → Review & Submit), and six
 * record tabs (Inspection Checklist, Site Details, Evidence & Observations,
 * Documents, Previous Reports, Notes) plus the Review & Submit panel.
 *
 * Everything reads `useMockInspections()` so a checklist answer, an evidence
 * record or a finding raised anywhere in the app is reflected immediately.
 * Nothing is persisted until an explicit Save; unsaved checklist drafts are
 * owned by this component keyed by item id, so switching items, sections or
 * tabs never discards the inspector's work.
 */
'use client';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Clock, CloudSun, FileText,
  History, Link2, MapPin, Paperclip, Pencil, Plus, RefreshCw, Save, ScrollText,
  Send, StickyNote, TriangleAlert, Trash2, Undo2, Upload, UserCog, X,
} from 'lucide-react';

import {
  ConfirmDialog, EmptyState, Field, Modal, SectionCard,
} from '../operations/ui';
import {
  ChecklistItemCard, type ChecklistItemDraft,
} from './checklist-item';
import {
  ChecklistMeter, ConditionChip, InlineError, LocationPreview, Menu, NavBtn, PermBtn,
  PriorityChip, ResponseChip, SaveHint, SectionProgressList, StatusChip, WorkflowStepper,
  PermissionHint, type MenuItem,
} from './ui';
import {
  actions, activityFor, checklistFor, compareWithPrevious, currentInspector,
  documentsFor, evidenceFor, findingsFor, inspectionOf, itemsOf, notesFor,
  previousReportsFor, reportOf, requestsFor, rolePermissions, siteLabel, siteOf,
  useMockInspections,
} from '../../lib/inspections/store';
import {
  CHECKLIST_RESPONSES, DEMO_TODAY, DETAIL_TABS, DOCUMENT_CATEGORIES, EVIDENCE_TYPES,
  FINDING_STATUSES, FindingCategory, Severity, SAFETY_CONDITIONS, WEATHER_OPTIONS,
  WORKFLOW_STEPS, type ChecklistProgress, type ChecklistResponseValue, type ChecklistRow, type DetailTab,
  type DocumentCategory, type EvidenceType, type Inspection, type MineSite,
} from '../../lib/inspections/types';
import {
  demoNow, durationLabel, effectiveStatusOf, fmtDate, fmtDateTime, fmtSize,
  fmtTime, priorityTone, statusTone, weekdayLong,
} from '../../lib/inspections/format';
import { downloadChecklist, downloadInspectionDetail, downloadReport } from '../../lib/inspections/export';

const REVIEW_TAB = 'Review & Submit' as DetailTab;

/** Synthetic sample files — this demo never uploads or fetches a real asset. */
const SAMPLE_FILES = [
  { name: 'haul-road-berm.jpg', sizeKb: 1840, label: 'Site photograph (JPG)' },
  { name: 'crusher-guard-missing.jpg', sizeKb: 2210, label: 'Site photograph (JPG)' },
  { name: 'ventilation-readings.pdf', sizeKb: 320, label: 'Scanned document (PDF)' },
  { name: 'emergency-egress.mp4', sizeKb: 8640, label: 'Video reference (MP4)' },
  { name: 'inspector-observation.txt', sizeKb: 14, label: 'Inspector note (TXT)' },
];

const CATEGORY_VALUES = Object.values(FindingCategory);
const SEVERITY_VALUES = Object.values(Severity);

function siteDetailsMissing(s: Inspection['siteDetails']): string[] {
  const missing: string[] = [];
  if (!s.weather) missing.push('weather');
  if (!s.safetyConditions) missing.push('safety conditions');
  if (!s.locationDescription.trim()) missing.push('location description');
  if (!s.inspectionDate) missing.push('inspection date');
  if (!s.startTime || !s.endTime) missing.push('start and end time');
  return missing;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function InspectionDetailPage({ inspectionId }: { inspectionId: string }) {
  const db = useMockInspections();
  const router = useRouter();
  const params = useSearchParams();

  const inspection = inspectionOf(db, inspectionId);
  const site: MineSite | undefined = inspection ? siteOf(db, inspection.mineId) : undefined;

  const [error, setError] = useState('');
  // Checklist drafts are keyed by item id so nothing is lost on navigation.
  const [drafts, setDrafts] = useState<Record<string, ChecklistItemDraft>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<string | null>(null);

  // Evidence / finding / document / request modals
  const [evidenceModal, setEvidenceModal] = useState<null | { itemId?: string | null; type?: EvidenceType }>(null);
  const [viewEvidenceId, setViewEvidenceId] = useState<string | null>(null);
  const [findingModal, setFindingModal] = useState<null | { itemId?: string | null }>(null);
  const [documentModal, setDocumentModal] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [viewReportId, setViewReportId] = useState<string | null>(null);
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);

  const tabParam = params.get('tab');
  const tab: DetailTab = (tabParam && (DETAIL_TABS as readonly string[]).includes(tabParam))
    ? (tabParam as DetailTab)
    : tabParam === REVIEW_TAB ? REVIEW_TAB : 'Inspection Checklist';

  const progress = useMemo(
    () => (inspection ? checklistFor(db, inspectionId) : null),
    [db, inspectionId, inspection],
  );
  const evidenceList = useMemo(() => evidenceFor(db, inspectionId), [db, inspectionId, inspection]);
  const findingList = useMemo(() => findingsFor(db, inspectionId), [db, inspectionId, inspection]);

  if (!inspection || !site || !progress) {
    return (
      <div className="space-y-4">
        <NavBtn href="/inspector/inspections" icon={<ArrowLeft size={14} />}>Back to My Inspections</NavBtn>
        <EmptyState
          title={`Inspection ${inspectionId} was not found`}
          sub="It may have been removed by a demo reset, or the link is out of date. The inspection list below still has every other record."
          action={<NavBtn href="/inspector/inspections">Open My Inspections</NavBtn>}
        />
      </div>
    );
  }

  const closed = inspection.status === 'Completed' || inspection.status === 'Cancelled';
  const completedView = inspection.status === 'Completed';
  const perms = rolePermissions(db);
  const effective = effectiveStatusOf(inspection);
  // Narrowed aliases — hoisted `function` declarations below cannot see the
  // early-return narrowing, so they read these instead.
  const insp: Inspection = inspection;
  const st: MineSite = site;
  const prog: ChecklistProgress = progress;
  const activeName = activeSection ?? prog.sections[0]?.name ?? '';
  const activeSectionView = prog.sections.find((s) => s.name === activeName) ?? prog.sections[0];
  const evidenceMet = evidenceList.length >= insp.requiredEvidenceCount;
  const missingSite = siteDetailsMissing(insp.siteDetails);
  const currentReport = reportOf(db, inspectionId);
  const openFindings = findingList.filter((f) => f.status !== 'Resolved');

  const setTab = (next: string) => {
    const q = new URLSearchParams(params.toString());
    q.set('tab', next);
    q.set('id', inspectionId);
    router.replace(`/inspector/inspections/${inspectionId}?${q.toString()}`, { scroll: false });
  };

  const draftFor = (row: ChecklistRow): ChecklistItemDraft =>
    drafts[row.item.id] ?? { response: row.response, remarks: row.remarks };

  const isDirty = (row: ChecklistRow) => {
    const d = draftFor(row);
    return d.response !== row.response || d.remarks !== row.remarks;
  };

  const run = (fn: () => void) => {
    try { setError(''); fn(); } catch (e) { setError(msg(e)); }
  };

  // ------------------------------------------------------------------ actions
  const saveRow = (row: ChecklistRow) => {
    run(() => {
      const d = draftFor(row);
      // Preserve every existing link for this item; a Non-Compliant answer on an
      // evidence-required item then satisfies the store's validation.
      const linked = evidenceList.filter((e) => e.itemId === row.item.id).map((e) => e.id);
      actions.saveChecklistResponse({
        inspectionId, itemId: row.item.id, response: d.response,
        remarks: d.remarks, evidenceIds: linked,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.item.id];
        return next;
      });
    });
  };

  const startInspection = () => {
    run(() => {
      actions.startInspection(inspectionId);
      setActiveSection(progress.sections[0]?.name ?? null);
      setDrafts({});
    });
  };

  const goToStep = (i: number) => {
    if (i === inspection.workflowStep) return;
    if (i > inspection.workflowStep) {
      // Guarded advancement — each rule throws a specific, human message.
      try {
        if (inspection.workflowStep === 0 && progress.completed === 0) {
          throw new Error('Answer at least one checklist item before moving to On-Site Verification.');
        }
        if (inspection.workflowStep === 1 && missingSite.length > 0) {
          throw new Error(`Complete the Site Details tab before continuing — still missing: ${missingSite.join(', ')}.`);
        }
        if (inspection.workflowStep === 2 && !evidenceMet) {
          throw new Error(`Attach at least ${inspection.requiredEvidenceCount} evidence records before Review & Submit (currently ${evidenceList.length}).`);
        }
      } catch (e) { setError(msg(e)); return; }
    }
    run(() => actions.setWorkflowStep(inspectionId, i));
    const tabForStep: Record<number, string> = {
      0: 'Inspection Checklist', 1: 'Site Details', 2: 'Evidence & Observations', 3: REVIEW_TAB,
    };
    setTab(tabForStep[i]);
  };

  const doSubmit = () => {
    try {
      const reportId = actions.submitInspection(inspectionId);
      setSubmittedReport(reportId ?? null);
      setConfirmOpen(false);
    } catch (e) { setError(msg(e)); setConfirmOpen(false); }
  };

  // ------------------------------------------------------------------ header
  const headerMeta: { label: string; value: React.ReactNode }[] = [
    { label: 'Mine', value: `${site.code} · ${site.name}` },
    { label: 'Area', value: site.area },
    { label: 'Type', value: inspection.type },
    { label: 'Scheduled', value: <>{fmtDate(inspection.scheduledDate)} <span className="text-slate-400">({weekdayLong(inspection.scheduledDate)})</span></> },
    { label: 'Time slot', value: `${fmtTime(inspection.startTime)} – ${fmtTime(inspection.endTime)} · ${durationLabel(inspection.durationMins)}` },
    { label: 'Location', value: inspection.location },
    { label: 'Priority', value: <PriorityChip v={inspection.priority} /> },
    { label: 'Assigned by', value: db.inspectors.find((x) => x.id === inspection.assignedBy)?.name ?? inspection.assignedBy },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <NavBtn href="/inspector/inspections" icon={<ArrowLeft size={14} />}>Back to My Inspections</NavBtn>
        {inspection.status === 'Upcoming' && (
          <PermBtn perm="canStart" onClick={startInspection} className="btn-primary">
            <Send size={14} className="inline mr-1" />Start Inspection
          </PermBtn>
        )}
        {inspection.status === 'In Progress' && (
          <button className="btn-primary" onClick={() => setTab(REVIEW_TAB)}
            title="Open the Review & Submit step for this inspection.">
            Continue inspection<ArrowRight size={14} className="inline ml-1" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <SaveHint at={inspection.lastSavedAt} />
          <Menu label="More Actions" items={moreActions()} />
        </div>
      </div>

      {error && <InlineError error={error} onDismiss={() => setError('')} />}

      {/* Header card */}
      <SectionCard
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-blue-700 bg-blue-50 rounded-lg px-1.5 py-0.5">{inspection.id}</span>
            <span>{inspection.title}</span>
            <StatusChip v={effective} />
            <PriorityChip v={inspection.priority} />
          </span>
        }
        subtitle={inspection.objective}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5">
          {headerMeta.map((m) => (
            <div key={m.label}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{m.label}</div>
              <div className="text-[12.5px] font-semibold text-navy mt-0.5">{m.value}</div>
            </div>
          ))}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Assigned inspector</div>
            <div className="text-[12.5px] font-semibold text-navy mt-0.5">
              {db.inspectors.find((x) => x.id === inspection.assignedTo)?.name ?? inspection.assignedTo}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Workflow step</div>
            <div className="text-[12.5px] font-semibold text-navy mt-0.5">
              {WORKFLOW_STEPS[inspection.workflowStep]} ({inspection.workflowStep + 1}/{WORKFLOW_STEPS.length})
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Required evidence</div>
            <div className={`text-[12.5px] font-semibold mt-0.5 ${evidenceMet ? 'text-emerald-600' : 'text-amber-600'}`}>
              {evidenceMet ? '✓ ' : '⚠ '}
              {evidenceList.length} of {inspection.requiredEvidenceCount} attached
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Open findings</div>
            <div className={`text-[12.5px] font-semibold mt-0.5 ${openFindings.length ? 'text-red-600' : 'text-emerald-600'}`}>
              {openFindings.length} open · {findingList.length} total
            </div>
          </div>
        </div>

        <div className="mt-4"><ChecklistMeter p={progress} /></div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-end gap-3 flex-wrap">
          <div className="min-w-0 flex-1"><WorkflowStepper steps={WORKFLOW_STEPS} active={inspection.workflowStep} onJump={goToStep} canEdit={!completedView} /></div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={() => run(() => actions.saveDraft(inspectionId))}
              disabled={closed}
              title={closed ? 'This inspection is read-only — nothing to save.' : 'Save your progress without submitting.'}>
              <Save size={14} className="inline mr-1" />Save progress
            </button>
            <button className="btn-secondary" onClick={() => goToStep(inspection.workflowStep - 1)}
              disabled={inspection.workflowStep === 0}
              title={inspection.workflowStep === 0 ? 'You are on the first step.' : 'Go back to the previous step.'}>
              <ArrowLeft size={14} className="inline mr-1" />Previous
            </button>
            <button className="btn-primary" onClick={() => goToStep(inspection.workflowStep + 1)}
              disabled={inspection.workflowStep >= WORKFLOW_STEPS.length - 1}
              title={inspection.workflowStep >= WORKFLOW_STEPS.length - 1
                ? 'You are on the final step.' : 'Validate this step and continue.'}>
              Next<ArrowRight size={14} className="inline ml-1" />
            </button>
          </div>
        </div>

        {completedView && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
            <CheckCircle2 size={14} className="inline mr-1 -mt-0.5" />
            This inspection was submitted on {fmtDateTime(inspection.submittedAt ?? '')}. It is read-only in this demo —
            record a separate re-inspection to capture further observations. Use the actions below to open the report or evidence.
          </div>
        )}
        {inspection.status === 'Cancelled' && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
            <X size={14} className="inline mr-1 -mt-0.5" />
            This inspection was cancelled{inspection.cancelReason ? ` — ${inspection.cancelReason}` : ''}. It cannot be started, edited or submitted.
          </div>
        )}
      </SectionCard>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Inspection sections">
          {[...DETAIL_TABS, REVIEW_TAB].map((t) => {
            const active = tab === t;
            const badge = t === 'Inspection Checklist' ? `${progress.completed}/${progress.totalItems}`
              : t === 'Evidence & Observations' ? String(evidenceList.length)
              : t === 'Documents' ? String(documentsFor(db, inspectionId).length)
              : t === 'Previous Reports' ? String(previousReportsFor(db, inspectionId).length + (currentReport ? 1 : 0))
              : t === 'Notes' ? String(notesFor(db, inspectionId).length)
              : null;
            return (
              <button key={t} onClick={() => setTab(t)}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 rounded-t-lg border-b-2 px-3.5 py-2 text-[12.5px] font-bold transition
                  ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-navy'}`}>
                {t}{badge && <span className="ml-1.5 badge bg-slate-100 text-slate-600 !text-[10px]">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'Inspection Checklist' && checklistTab()}
      {tab === 'Site Details' && siteDetailsTab()}
      {tab === 'Evidence & Observations' && evidenceTab()}
      {tab === 'Documents' && documentsTab()}
      {tab === 'Previous Reports' && reportsTab()}
      {tab === 'Notes' && notesTab()}
      {tab === REVIEW_TAB && reviewTab()}

      {/* ------------------------------------------------------------- modals */}
      {evidenceModal && (
        <AddEvidenceModal
          inspectionId={inspectionId}
          itemId={evidenceModal.itemId ?? null}
          presetType={evidenceModal.type}
          onClose={() => setEvidenceModal(null)}
          onError={setError}
        />
      )}
      {viewEvidenceId && (() => {
        const e = evidenceList.find((x) => x.id === viewEvidenceId);
        return e ? (
          <ViewEvidenceModal evidence={e} inspection={inspection} items={itemsOf(db, inspection.templateId)}
            canEdit={!closed} onClose={() => setViewEvidenceId(null)} onError={setError} />
        ) : null;
      })()}
      {findingModal && (
        <CreateFindingModal inspectionId={inspectionId} itemId={findingModal.itemId ?? null}
          onClose={() => setFindingModal(null)} onError={setError} />
      )}
      {documentModal && (
        <AttachDocumentModal inspectionId={inspectionId} onClose={() => setDocumentModal(false)} onError={setError} />
      )}
      {compareOpen && <CompareModal inspectionId={inspectionId} onClose={() => setCompareOpen(false)} />}
      {viewReportId && (() => {
        const r = db.reports.find((x) => x.id === viewReportId);
        return r ? (
          <ViewReportModal reportId={r.id} onClose={() => setViewReportId(null)} onError={setError} />
        ) : null;
      })()}
      {viewDocumentId && (() => {
        const d = documentsFor(db, inspectionId).find((x) => x.id === viewDocumentId);
        return d ? <ViewDocumentModal doc={d} onClose={() => setViewDocumentId(null)} onError={setError} /> : null;
      })()}
      {cancelOpen && (
        <CancelDialog inspectionId={inspectionId} onClose={() => setCancelOpen(false)} onError={setError} />
      )}
      {rescheduleOpen && (
        <RescheduleDialog inspectionId={inspectionId} onClose={() => setRescheduleOpen(false)} onError={setError} />
      )}
      {reassignOpen && (
        <ReassignDialog inspectionId={inspectionId} onClose={() => setReassignOpen(false)} onError={setError} />
      )}
      {confirmOpen && (
        <ConfirmDialog
          title={`Submit inspection ${inspection.id}?`}
          body={`This marks the inspection Completed, records the submission time, generates a synthetic report and updates the schedule and KPIs. This is a DEMO action — nothing is sent to DGMS or any regulator. A Completed inspection cannot be silently reopened.`}
          confirmLabel="Submit inspection"
          onConfirm={doSubmit}
          onCancel={() => setConfirmOpen(false)}
        />
      )}

      {/* Success panel replaces the submit button once submitted */}
      {submittedReport && (
        <SectionCard title="Inspection submitted">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-800">
            <CheckCircle2 size={16} className="inline mr-1.5 -mt-0.5" />
            <b>{inspection.id}</b> is now Completed. Report <b>{submittedReport}</b> was generated from the live
            checklist, evidence and findings — no counts were invented.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { setSubmittedReport(null); setTab('Previous Reports'); }}>
              <FileText size={14} className="inline mr-1" />View Report
            </button>
            <button className="btn-secondary" onClick={() => { setSubmittedReport(null); setTab('Evidence & Observations'); }}>
              <Paperclip size={14} className="inline mr-1" />View Evidence
            </button>
            <button className="btn-secondary" onClick={() => setSubmittedReport(null)}>
              <ClipboardList size={14} className="inline mr-1" />View Inspection
            </button>
            <NavBtn href="/inspector/reports">Open Reports page</NavBtn>
          </div>
        </SectionCard>
      )}
    </div>
  );

  // ------------------------------------------------------------------ menus
  function moreActions(): MenuItem[] {
    return [
      {
        label: 'Cancel inspection', icon: <X size={13} />, danger: true,
        disabled: closed, title: closed ? 'This inspection is closed and cannot be cancelled.' : undefined,
        onClick: () => setCancelOpen(true),
      },
      {
        label: 'Request reschedule', icon: <RefreshCw size={13} />,
        disabled: closed, title: closed ? 'This inspection is closed and cannot be rescheduled.' : undefined,
        onClick: () => setRescheduleOpen(true),
      },
      {
        label: 'Request reassignment', icon: <UserCog size={13} />,
        disabled: closed, title: closed ? 'This inspection is closed and cannot be reassigned.' : undefined,
        onClick: () => setReassignOpen(true),
      },
      {
        label: 'Download checklist (TXT)', icon: <ClipboardList size={13} />,
        onClick: () => run(() => {
          downloadChecklist(inspectionId, siteLabel(db, insp.mineId), prog);
          actions.logDownload(inspectionId, 'checklist', `Blank checklist for ${inspectionId}`);
        }),
      },
      {
        label: 'Download inspection detail (TXT)', icon: <FileText size={13} />,
        onClick: () => run(() => {
          downloadInspectionDetail(
            {
              inspection: insp, effectiveStatus: effective, overdue: effective === 'Overdue', site: st,
              assignedToName: db.inspectors.find((x) => x.id === insp.assignedTo)?.name ?? '',
              assignedByName: db.inspectors.find((x) => x.id === insp.assignedBy)?.name ?? '',
              progress: prog, evidenceCount: evidenceList.length, findingCount: findingList.length,
              openFindingCount: openFindings.length,
            },
            prog,
            { objective: insp.objective, durationMins: insp.durationMins, siteType: st.siteType, state: st.state, district: st.district },
          );
          actions.logDownload(inspectionId, 'checklist', `Detail for ${inspectionId}`);
        }),
      },
    ];
  }

  // ------------------------------------------------------------------ tabs
  function checklistTab() {
    return (
      <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
        <div className="space-y-3 lg:sticky lg:top-4">
          <SectionCard title="Sections" subtitle={`${progress!.completed}/${progress!.totalItems} answered · ${progress!.percent}%`}>
            <SectionProgressList sections={progress!.sections} activeName={activeName} onPick={setActiveSection} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button className="btn-ghost !py-1.5 !px-2.5 !text-[11.5px]" onClick={() => setActiveSection(null)}
                title="Show the first section.">All sections</button>
              <button className="btn-ghost !py-1.5 !px-2.5 !text-[11.5px]"
                onClick={() => {
                  const next = progress!.sections.find((s) => !s.complete);
                  setActiveSection(next ? next.name : null);
                }}
                title="Jump to the next section that still has unanswered items.">
                Next incomplete section
              </button>
            </div>
          </SectionCard>
          <SectionCard title="Progress summary">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <dt className="text-slate-500">Compliant</dt><dd className="text-right font-extrabold text-emerald-600">{progress!.compliant}</dd>
              <dt className="text-slate-500">Non-compliant</dt><dd className="text-right font-extrabold text-red-600">{progress!.nonCompliant}</dd>
              <dt className="text-slate-500">Not applicable</dt><dd className="text-right font-extrabold text-slate-500">{progress!.notApplicable}</dd>
              <dt className="text-slate-500">Not checked</dt><dd className="text-right font-extrabold text-amber-600">{progress!.pending}</dd>
              <dt className="text-slate-500">Mandatory remaining</dt><dd className="text-right font-extrabold text-navy">{progress!.mandatoryRemaining}</dd>
            </dl>
          </SectionCard>
        </div>

        <div className="space-y-3">
          {activeSectionView && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[14px] font-extrabold text-navy">
                  {activeSectionView.index + 1}. {activeSectionView.name}
                </h3>
                <span className="badge bg-slate-100 text-slate-600 !text-[10px]">
                  {activeSectionView.completed}/{activeSectionView.total} answered
                </span>
                {activeSectionView.complete
                  ? <span className="badge bg-emerald-100 text-emerald-700 !text-[10px]">Section complete</span>
                  : <span className="badge bg-amber-100 text-amber-700 !text-[10px]">{activeSectionView.notChecked} not checked</span>}
              </div>
              <div className="space-y-3">
                {activeSectionView.rows.map((row) => (
                  <ChecklistItemCard
                    key={row.item.id}
                    row={row}
                    draft={draftFor(row)}
                    dirty={isDirty(row)}
                    linkedEvidence={evidenceList.filter((e) => e.itemId === row.item.id)}
                    canEdit={!closed && perms.canWorkChecklist}
                    closed={closed}
                    onDraft={(d) => setDrafts((prev) => ({ ...prev, [row.item.id]: d }))}
                    onDiscard={() => setDrafts((prev) => { const n = { ...prev }; delete n[row.item.id]; return n; })}
                    onSave={() => saveRow(row)}
                    onAddNote={() => setEvidenceModal({ itemId: row.item.id, type: 'Inspector Note' })}
                    onAddEvidence={() => setEvidenceModal({ itemId: row.item.id })}
                    onCreateFinding={() => setFindingModal({ itemId: row.item.id })}
                    onViewEvidence={(id) => setViewEvidenceId(id)}
                    onViewLinked={() => setTab('Evidence & Observations')}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button className="btn-secondary !py-1.5 !px-3 !text-[12px]"
                  disabled={progress!.sections.findIndex((s) => s.name === activeName) <= 0}
                  title={progress!.sections.findIndex((s) => s.name === activeName) <= 0 ? 'This is the first section.' : 'Go to the previous section.'}
                  onClick={() => {
                    const i = progress!.sections.findIndex((s) => s.name === activeName);
                    setActiveSection(progress!.sections[Math.max(0, i - 1)].name);
                  }}>
                  <ArrowLeft size={13} className="inline mr-1" />Previous section
                </button>
                <button className="btn-primary !py-1.5 !px-3 !text-[12px]"
                  disabled={progress!.sections.findIndex((s) => s.name === activeName) >= progress!.sections.length - 1}
                  title={progress!.sections.findIndex((s) => s.name === activeName) >= progress!.sections.length - 1 ? 'This is the last section.' : 'Go to the next section.'}
                  onClick={() => {
                    const i = progress!.sections.findIndex((s) => s.name === activeName);
                    setActiveSection(progress!.sections[Math.min(progress!.sections.length - 1, i + 1)].name);
                  }}>
                  Next section<ArrowRight size={13} className="inline ml-1" />
                </button>
                <span className="ml-auto text-[11px] text-slate-400">
                  {Object.keys(drafts).length > 0
                    ? `${Object.keys(drafts).length} item(s) with unsaved changes`
                    : 'All saved changes are stored locally (demo)'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function siteDetailsTab() {
    const s = inspection!.siteDetails;
    const upd = (patch: Record<string, unknown>) => run(() => actions.updateSiteDetails(inspectionId, patch));
    return (
      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <SectionCard
          title="Site Details"
          subtitle={missingSite.length === 0
            ? 'Complete — this step can be advanced.'
            : `Still missing: ${missingSite.join(', ')}`}
          action={s.completedAt ? <span className="badge bg-emerald-100 text-emerald-700 !text-[10px]">Completed</span> : undefined}
        >
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Weather" hint="Recorded on site.">
              <select className="input" value={s.weather} disabled={closed} onChange={(e) => upd({ weather: e.target.value })}>
                <option value="">Select weather…</option>
                {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
            <Field label="Safety conditions" hint="Overall condition at the time of inspection.">
              <select className="input" value={s.safetyConditions} disabled={closed} onChange={(e) => upd({ safetyConditions: e.target.value })}>
                <option value="">Select conditions…</option>
                {SAFETY_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Inspection date">
              <input type="date" className="input" value={s.inspectionDate} disabled={closed}
                onChange={(e) => upd({ inspectionDate: e.target.value })} />
            </Field>
            <Field label="Crew strength" hint="Workers present in the inspected area.">
              <input type="number" min={0} className="input" value={s.crewStrength ?? ''} disabled={closed}
                onChange={(e) => upd({ crewStrength: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Start time">
              <input type="time" className="input" value={s.startTime} disabled={closed}
                onChange={(e) => upd({ startTime: e.target.value })} />
            </Field>
            <Field label="End time">
              <input type="time" className="input" value={s.endTime} disabled={closed}
                onChange={(e) => upd({ endTime: e.target.value })} />
            </Field>
          </div>
          <Field label="Location description" hint="Where on the site the verification was carried out.">
            <textarea className="input" rows={2} value={s.locationDescription} disabled={closed}
              onChange={(e) => upd({ locationDescription: e.target.value })} />
          </Field>
          <Field label="General remarks" hint="Anything that does not belong to a specific checklist item.">
            <textarea className="input" rows={3} value={s.generalRemarks} disabled={closed}
              onChange={(e) => upd({ generalRemarks: e.target.value })} />
          </Field>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span><b>Mine:</b> {site!.code} · {site!.name}</span>
              <span><b>Location:</b> {inspection!.location}</span>
              <span><b>Inspector:</b> {db.inspectors.find((x) => x.id === s.inspectorId)?.name ?? s.inspectorId}</span>
              {s.completedAt && <span><b>Saved:</b> {fmtDateTime(s.completedAt)}</span>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={closed}
              title={closed ? 'This inspection is read-only.' : 'Save the site details entered above.'}
              onClick={() => run(() => actions.saveDraft(inspectionId))}>
              <Save size={14} className="inline mr-1" />Save draft
            </button>
            <button className="btn-secondary" disabled={missingSite.length > 0}
              title={missingSite.length > 0 ? `Still missing: ${missingSite.join(', ')}` : 'Site details are complete — continue to Evidence & Observations.'}
              onClick={() => goToStep(2)}>
              Continue to Evidence<ArrowRight size={14} className="inline ml-1" />
            </button>
            {closed && <span className="text-[11.5px] text-slate-400 self-center">Read-only — this inspection was already submitted.</span>}
          </div>
        </SectionCard>

        <div className="space-y-3">
          <LocationPreview site={site!} location={inspection!.location} />
          <SectionCard title="Condition overview">
            <div className="flex items-center gap-2 text-[12.5px]">
              <CloudSun size={16} className="text-blue-600" />
              <span className="font-semibold text-navy">{s.weather || 'Not recorded'}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[12px] text-slate-500">Safety conditions</span>
              {s.safetyConditions ? <ConditionChip v={s.safetyConditions} /> : <span className="text-[12px] text-slate-400">Not recorded</span>}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-slate-500">
              <Clock size={14} className="text-slate-400" />
              {fmtTime(s.startTime)} – {fmtTime(s.endTime)} · {durationLabel(inspection!.durationMins)}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  function evidenceTab() {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[13px] font-bold text-navy">
            {evidenceList.length} evidence record{evidenceList.length === 1 ? '' : 's'}
            <span className={`ml-2 text-[12px] font-semibold ${evidenceMet ? 'text-emerald-600' : 'text-amber-600'}`}>
              {evidenceMet ? `✓ meets the ${inspection!.requiredEvidenceCount} required` : `⚠ ${evidenceList.length} of ${inspection!.requiredEvidenceCount} required`}
            </span>
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn-secondary" onClick={() => run(() => {
              import('../../lib/inspections/export').then(() => {});
            })} style={{ display: 'none' }} />
            <PermBtn perm="canManageEvidence" onClick={() => setEvidenceModal({})} className="btn-primary"
              disabled={closed} title={closed ? 'This inspection is read-only — no new evidence can be captured.' : undefined}>
              <Plus size={14} className="inline mr-1" />Add Evidence
            </PermBtn>
          </div>
        </div>

        {evidenceList.length === 0 ? (
          <EmptyState title="No evidence captured yet"
            sub="Attach photographs, documents, video references or inspector notes against this inspection. At least one is required for every checklist item flagged evidence-required."
            action={<PermBtn perm="canManageEvidence" onClick={() => setEvidenceModal({})} className="btn-primary"
              disabled={closed} title={closed ? 'This inspection is read-only.' : undefined}>Add the first evidence record</PermBtn>} />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {evidenceList.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col">
                <div className="flex items-start gap-2">
                  <Paperclip size={15} className="text-blue-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-navy leading-snug">{e.title}</div>
                    <div className="font-mono text-[10.5px] text-slate-400">{e.id} · {e.type}</div>
                  </div>
                </div>
                <p className="mt-1.5 text-[12px] text-slate-600 line-clamp-2">{e.description}</p>
                <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                  <div>File: <span className="font-semibold">{e.fileName}</span> · {fmtSize(e.sizeKb * 1024)}</div>
                  <div>Captured {fmtDateTime(e.capturedAt)}</div>
                  <div>Location: {e.location}</div>
                  <div>By: {db.inspectors.find((x) => x.id === e.uploadedBy)?.name ?? e.uploadedBy}</div>
                </div>
                {e.itemId && (
                  <div className="mt-1.5 text-[11px] text-slate-500">
                    Linked item: <span className="font-mono text-blue-700">{e.itemId}</span>
                  </div>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  <button className="btn-secondary !py-1 !px-2 !text-[11.5px]" onClick={() => setViewEvidenceId(e.id)}
                    title={`Open ${e.id}`}>View</button>
                  <button className="btn-secondary !py-1 !px-2 !text-[11.5px]" disabled={closed}
                    title={closed ? 'This inspection is read-only.' : `Change the checklist item linked to ${e.id}.`}
                    onClick={() => setEvidenceModal({ itemId: e.itemId })}>
                    <Link2 size={12} className="inline mr-0.5" />Link
                  </button>
                  <button className="btn-ghost !py-1 !px-2 !text-[11.5px] text-red-600" disabled={closed}
                    title={closed ? 'A submitted inspection keeps its evidence — this is a DEMO safeguard.' : `Remove ${e.id}. It is also unlinked from responses and findings.`}
                    onClick={() => run(() => actions.removeEvidence(e.id))}>
                    <Trash2 size={12} className="inline mr-0.5" />Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Findings raised on this inspection */}
        <SectionCard title="Findings & Observations" subtitle={`${findingList.length} raised · ${openFindings.length} open`}
          action={<PermBtn perm="canCreateFinding" onClick={() => setFindingModal({})} className="btn-secondary !py-1.5 !px-3 !text-[12px]"
            disabled={closed} title={closed ? 'This inspection is closed — record a re-inspection instead.' : undefined}>
            <Plus size={13} className="inline mr-1" />Create finding
          </PermBtn>}>
          {findingList.length === 0 ? (
            <EmptyState title="No findings raised on this inspection"
              sub="A finding is created automatically as an option when a checklist item is marked Non-Compliant, or you can raise one directly against the inspection." />
          ) : (
            <div className="overflow-x-auto">
              <table className="dense min-w-[860px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Severity</th>
                    <th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Assignee</th>
                    <th className="py-2 pr-3">Due</th><th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody className="text-[12px]">
                  {findingList.map((f) => {
                    const idx = FINDING_STATUSES.indexOf(f.status);
                    const nextStatus = idx >= 0 && idx < FINDING_STATUSES.length - 1 ? FINDING_STATUSES[idx + 1] : null;
                    return (
                      <tr key={f.id} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-3 font-mono text-[11px] text-blue-700">{f.id}</td>
                        <td className="py-2 pr-3 font-mono text-[11px]">{f.itemId ?? '—'}</td>
                        <td className="py-2 pr-3">{f.category}</td>
                        <td className="py-2 pr-3">
                          <span className={`badge !text-[10px] ${f.severity === 'Critical' || f.severity === 'High' ? 'bg-red-100 text-red-600' : f.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{f.severity}</span>
                        </td>
                        <td className="py-2 pr-3"><StatusChip v={f.status} /></td>
                        <td className="py-2 pr-3">{f.assignee}</td>
                        <td className={`py-2 pr-3 ${f.status !== 'Resolved' && f.dueDate < DEMO_TODAY ? 'text-red-600 font-bold' : ''}`}>{fmtDate(f.dueDate)}</td>
                        <td className="py-2 pr-3">
                          <PermBtn perm="canCreateFinding" className="btn-secondary !py-1 !px-2 !text-[11px]"
                            disabled={!nextStatus || closed}
                            title={!nextStatus ? 'This finding is already Resolved.' : closed ? 'This inspection is read-only.' : `Advance ${f.id} to "${nextStatus}".`}
                            onClick={() => run(() => nextStatus && actions.updateFindingStatus(f.id, nextStatus))}>
                            {nextStatus ? `→ ${nextStatus}` : 'Resolved'}
                          </PermBtn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function documentsTab() {
    const docs = documentsFor(db, inspectionId);
    return (
      <SectionCard title="Documents" subtitle={`${docs.length} attached to this inspection`}
        action={<PermBtn perm="canManageEvidence" onClick={() => setDocumentModal(true)} className="btn-secondary !py-1.5 !px-3 !text-[12px]"
          disabled={closed} title={closed ? 'This inspection is read-only.' : undefined}>
          <Upload size={13} className="inline mr-1" />Attach document
        </PermBtn>}>
        {docs.length === 0 ? (
          <EmptyState title="No documents attached"
            sub="Attach a safety SOP, mine layout, previous report, equipment checklist or permit so the inspection record is self-contained." />
        ) : (
          <div className="overflow-x-auto">
            <table className="dense min-w-[760px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">ID</th><th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Category</th><th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Updated</th><th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {docs.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-mono text-[11px] text-blue-700">{d.id}</td>
                    <td className="py-2 pr-3 font-semibold text-navy">{d.title}</td>
                    <td className="py-2 pr-3"><span className="badge bg-slate-100 text-slate-600 !text-[10px]">{d.category}</span></td>
                    <td className="py-2 pr-3">{d.fileName} · {fmtSize(d.sizeKb * 1024)}</td>
                    <td className="py-2 pr-3">{fmtDateTime(d.updatedAt)}</td>
                    <td className="py-2 pr-3">{db.inspectors.find((x) => x.id === d.owner)?.name ?? d.owner}</td>
                    <td className="py-2 pr-3">
                      <div className="flex gap-1.5">
                        <button className="btn-secondary !py-1 !px-2 !text-[11px]" onClick={() => setViewDocumentId(d.id)}
                          title={`View the demo contents of ${d.fileName}.`}>View</button>
                        <button className="btn-secondary !py-1 !px-2 !text-[11px]"
                          onClick={() => run(() => {
                            const { downloadDocument } = require('../../lib/inspections/export') as typeof import('../../lib/inspections/export');
                            downloadDocument(d.title, d.fileName, sampleDocumentBody(d));
                            actions.logDownload(inspectionId, 'document', `${d.id} — ${d.title}`);
                          })}
                          title={`Download a DEMO copy of ${d.fileName}.`}>Download</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    );
  }

  function reportsTab() {
    const previous = previousReportsFor(db, inspectionId);
    return (
      <div className="space-y-3">
        {currentReport && (
          <SectionCard title="Current report" subtitle="Generated when this inspection was submitted."
            action={<span className="badge bg-blue-50 text-blue-700 !text-[10px]">v{currentReport.version}</span>}>
            <div className="flex items-start gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-extrabold text-navy">{currentReport.id} · {currentReport.title}</div>
                <div className="mt-0.5 text-[12px] text-slate-600">{currentReport.summary}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="badge bg-emerald-100 text-emerald-700 !text-[10px]">{currentReport.counts.compliant} compliant</span>
                  <span className="badge bg-red-100 text-red-600 !text-[10px]">{currentReport.counts.nonCompliant} non-compliant</span>
                  <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{currentReport.counts.notApplicable} n/a</span>
                  <span className="badge bg-sky-100 text-sky-700 !text-[10px]">{currentReport.counts.evidence} evidence</span>
                  <span className="badge bg-amber-100 text-amber-700 !text-[10px]">{currentReport.counts.findings} findings</span>
                </div>
              </div>
              <StatusChip v={currentReport.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setViewReportId(currentReport.id)}>
                <FileText size={14} className="inline mr-1" />View report
              </button>
              <button className="btn-secondary" onClick={() => run(() => {
                downloadReport(currentReport, {
                  mineLabel: siteLabel(db, currentReport.mineId),
                  inspector: db.inspectors.find((x) => x.id === currentReport.inspectorId)?.name ?? currentReport.inspectorId,
                  scheduledDate: inspection!.scheduledDate,
                  type: currentReport.type,
                  title: currentReport.title,
                });
                actions.logDownload(inspectionId, 'report', `${currentReport.id} — ${currentReport.title}`);
              })}>
                <FileText size={14} className="inline mr-1" />Download
              </button>
              <span className="self-center text-[11px] text-slate-400">DEMO export — not a DGMS submission.</span>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Previous reports" subtitle={`Completed ${inspection!.type} inspections at ${site!.code}`}
          action={<button className="btn-secondary !py-1.5 !px-3 !text-[12px]" onClick={() => setCompareOpen(true)}
            disabled={previous.length === 0}
            title={previous.length === 0 ? 'No previous completed inspection to compare against.' : 'Compare this checklist against the last completed inspection at this mine.'}>
            <History size={13} className="inline mr-1" />Compare with Previous Inspection
          </button>}>
          {previous.length === 0 ? (
            <EmptyState title="No previous reports for this mine and inspection type"
              sub="Comparison becomes available once a second inspection of the same type is completed at this mine." />
          ) : (
            <div className="overflow-x-auto">
              <table className="dense min-w-[720px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Report</th><th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Submitted</th><th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Counts</th><th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-[12px]">
                  {previous.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 font-mono text-[11px] text-blue-700">{r.id}</td>
                      <td className="py-2 pr-3 font-semibold text-navy">{r.title}</td>
                      <td className="py-2 pr-3">{fmtDate(r.submittedAt.slice(0, 10))}</td>
                      <td className="py-2 pr-3"><StatusChip v={r.status} /></td>
                      <td className="py-2 pr-3 text-slate-500">{r.counts.compliant}✓ {r.counts.nonCompliant}✗ {r.counts.evidence}📎</td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-1.5">
                          <button className="btn-secondary !py-1 !px-2 !text-[11px]" onClick={() => setViewReportId(r.id)}
                            title={`Open ${r.id}.`}>View</button>
                          <button className="btn-secondary !py-1 !px-2 !text-[11px]"
                            onClick={() => run(() => {
                              downloadReport(r, {
                                mineLabel: siteLabel(db, r.mineId),
                                inspector: db.inspectors.find((x) => x.id === r.inspectorId)?.name ?? r.inspectorId,
                                scheduledDate: r.submittedAt.slice(0, 10), type: r.type, title: r.title,
                              });
                              actions.logDownload(inspectionId, 'report', `${r.id} — ${r.title}`);
                            })}
                            title={`Download ${r.id}.`}>Download</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function notesTab() {
    const notes = [...notesFor(db, inspectionId)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return <NotesPanel inspectionId={inspectionId} notes={notes} closed={closed} onError={setError} />;
  }

  function reviewTab() {
    const blockers: { ok: boolean; label: string; detail?: string }[] = [
      {
        ok: progress!.pending === 0,
        label: 'Every checklist item answered',
        detail: progress!.pending === 0 ? undefined
          : progress!.sections.filter((s) => s.notChecked > 0).map((s) => `${s.name} (${s.notChecked})`).join(', '),
      },
      {
        ok: missingSite.length === 0,
        label: 'Site details complete',
        detail: missingSite.length === 0 ? undefined : `Missing: ${missingSite.join(', ')}`,
      },
      {
        ok: evidenceMet,
        label: `At least ${inspection!.requiredEvidenceCount} evidence records attached`,
        detail: evidenceMet ? undefined : `${evidenceList.length} of ${inspection!.requiredEvidenceCount} attached`,
      },
      { ok: true, label: `${findingList.length} findings recorded (${openFindings.length} still open)` },
    ];
    const blocked = blockers.some((b) => !b.ok);

    return (
      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-3">
          <SectionCard title="Review & Submit" subtitle="Check the record before submitting — submission is irreversible in this demo.">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-[12px]">
                <div><span className="text-slate-400">Inspection</span><div className="font-bold text-navy">{inspection!.id}</div></div>
                <div><span className="text-slate-400">Mine</span><div className="font-bold text-navy">{site!.code} · {site!.name}</div></div>
                <div><span className="text-slate-400">Type</span><div className="font-bold text-navy">{inspection!.type}</div></div>
                <div><span className="text-slate-400">Scheduled</span><div className="font-bold text-navy">{fmtDate(inspection!.scheduledDate)}</div></div>
                <div><span className="text-slate-400">Inspector</span><div className="font-bold text-navy">{db.inspectors.find((x) => x.id === inspection!.assignedTo)?.name}</div></div>
                <div><span className="text-slate-400">Duration</span><div className="font-bold text-navy">{durationLabel(inspection!.durationMins)}</div></div>
              </div>
            </div>

            <h4 className="mt-4 text-[13px] font-extrabold text-navy">Checklist tallies</h4>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                ['Total', progress!.totalItems, 'text-navy'],
                ['Answered', progress!.completed, 'text-emerald-600'],
                ['Compliant', progress!.compliant, 'text-emerald-600'],
                ['Non-compliant', progress!.nonCompliant, 'text-red-600'],
                ['Not applicable', progress!.notApplicable, 'text-slate-500'],
                ['Not checked', progress!.pending, 'text-amber-600'],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <div className="text-[10.5px] uppercase tracking-wide text-slate-400">{label}</div>
                  <div className={`text-[16px] font-extrabold ${tone}`}>{value}</div>
                </div>
              ))}
            </div>

            <h4 className="mt-4 text-[13px] font-extrabold text-navy">Per-section completion</h4>
            <div className="mt-2 overflow-x-auto">
              <table className="dense min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3">Section</th><th className="py-2 pr-3">Answered</th>
                    <th className="py-2 pr-3">Compliant</th><th className="py-2 pr-3">Non-compliant</th>
                    <th className="py-2 pr-3">Not checked</th><th className="py-2 pr-3">State</th>
                  </tr>
                </thead>
                <tbody className="text-[12px]">
                  {progress!.sections.map((s) => (
                    <tr key={s.name} className="border-t border-slate-100">
                      <td className="py-2 pr-3 font-semibold text-navy">{s.name}</td>
                      <td className="py-2 pr-3">{s.completed}/{s.total}</td>
                      <td className="py-2 pr-3 text-emerald-600">{s.compliant}</td>
                      <td className="py-2 pr-3 text-red-600">{s.nonCompliant}</td>
                      <td className={`py-2 pr-3 ${s.notChecked ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{s.notChecked}</td>
                      <td className="py-2 pr-3">
                        {s.complete ? <span className="badge bg-emerald-100 text-emerald-700 !text-[10px]">Complete</span>
                          : <span className="badge bg-amber-100 text-amber-700 !text-[10px]">Incomplete</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="mt-4 text-[13px] font-extrabold text-navy">Evidence & findings</h4>
            <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
              <span className={`badge !text-[11px] ${evidenceMet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {evidenceList.length} of {inspection!.requiredEvidenceCount} evidence records
              </span>
              <span className="badge bg-slate-100 text-slate-600 !text-[11px]">{findingList.length} findings</span>
              <span className={`badge !text-[11px] ${openFindings.length ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                {openFindings.length} open findings
              </span>
            </div>

            <label className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={confirmed} disabled={closed || blocked}
                onChange={(e) => setConfirmed(e.target.checked)} />
              <span className="text-[12.5px] text-slate-700">
                I confirm the observations recorded above are accurate and the evidence reflects what was seen on site.
                <span className="block text-[11px] text-slate-400 mt-0.5">DEMO only — this does not submit anything to DGMS or any regulator.</span>
              </span>
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={closed || blocked || !confirmed}
                title={closed
                  ? 'This inspection has already been submitted.'
                  : blocked ? 'Resolve the outstanding items listed above before submitting.'
                  : !confirmed ? 'Tick the confirmation box to enable submission.'
                  : 'Submit this inspection and generate the report.'}
                onClick={() => setConfirmOpen(true)}>
                <Send size={14} className="inline mr-1" />Submit inspection
              </button>
              <span className="text-[11.5px] text-slate-500">
                {blocked ? 'Submission is blocked until every section is complete.' : 'All checks pass — submission is ready.'}
              </span>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-3">
          <SectionCard title="Validation checklist">
            <ul className="space-y-2">
              {blockers.map((b) => (
                <li key={b.label} className="flex items-start gap-2 text-[12px]">
                  <span className={`mt-0.5 shrink-0 ${b.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {b.ok ? <Check size={14} /> : <TriangleAlert size={14} />}
                  </span>
                  <span className="min-w-0">
                    <span className={b.ok ? 'text-slate-600' : 'font-bold text-red-600'}>{b.label}</span>
                    {b.detail && <span className="block text-[11px] text-red-500">{b.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard title="Notes preview">
            {notesFor(db, inspectionId).length === 0 ? (
              <p className="text-[12px] text-slate-400">No notes recorded on this inspection.</p>
            ) : (
              <ul className="space-y-2">
                {notesFor(db, inspectionId).slice(0, 3).map((n) => (
                  <li key={n.id} className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11.5px] text-slate-700 line-clamp-3">{n.body}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-400">
                      {n.draft && <span className="badge bg-amber-100 text-amber-700 !text-[9px]">DRAFT</span>}
                      {fmtDateTime(n.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-secondary mt-2 !py-1.5 !px-3 !text-[12px]" onClick={() => setTab('Notes')}>
              <StickyNote size={13} className="inline mr-1" />Open notes
            </button>
          </SectionCard>
          <PermissionHint />
          <SectionCard title="Activity">
            <ul className="space-y-1.5">
              {activityFor(db, inspectionId).slice(-6).reverse().map((a) => (
                <li key={a.id} className="text-[11.5px] text-slate-600">
                  <span className="font-bold text-navy">{a.action}</span> — {a.detail}
                  <span className="block text-[10.5px] text-slate-400">{fmtDateTime(a.at)} · {a.by}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// Notes panel (also used standalone by the Notes tab)
// ---------------------------------------------------------------------------

function NotesPanel({ inspectionId, notes, closed, onError }: {
  inspectionId: string;
  notes: ReturnType<typeof notesFor>;
  closed: boolean;
  onError: (m: string) => void;
}) {
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const submit = (draft: boolean) => {
    try {
      if (!body.trim()) throw new Error('Write the note text before saving.');
      actions.addNote(inspectionId, body.trim(), draft);
      setBody('');
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
      <SectionCard title="Add a note" subtitle="Notes are timestamped and attributed to you in this demo.">
        <textarea className="input" rows={5} value={body} disabled={closed}
          disabled-title={closed ? 'This inspection is read-only.' : undefined}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Observation, handover note or follow-up reminder…" />
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-primary !py-1.5 !px-3 !text-[12px]" disabled={closed || !body.trim()}
            title={closed ? 'This inspection is read-only.' : !body.trim() ? 'Write the note text first.' : 'Save and publish this note.'}
            onClick={() => submit(false)}>
            <Save size={13} className="inline mr-1" />Publish
          </button>
          <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" disabled={closed || !body.trim()}
            title={closed ? 'This inspection is read-only.' : !body.trim() ? 'Write the note text first.' : 'Save this note as a draft.'}
            onClick={() => submit(true)}>
            <StickyNote size={13} className="inline mr-1" />Save as draft
          </button>
        </div>
        {closed && <p className="mt-2 text-[11.5px] text-slate-400">This inspection is read-only — notes cannot be added.</p>}
      </SectionCard>

      <SectionCard title="Note history" subtitle={`${notes.length} note${notes.length === 1 ? '' : 's'}`}>
        {notes.length === 0 ? (
          <EmptyState title="No notes yet"
            sub="Record handover notes, follow-up reminders or clarifications that do not belong to a specific checklist item." />
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] text-blue-700">{n.id}</span>
                  {n.draft && <span className="badge bg-amber-100 text-amber-700 !text-[10px]">DRAFT</span>}
                  <span className="text-[11px] text-slate-400">
                    {fmtDateTime(n.createdAt)}{n.updatedAt !== n.createdAt && <> · edited {fmtDateTime(n.updatedAt)}</>}
                  </span>
                  <div className="ml-auto flex gap-1.5">
                    {editingId === n.id ? (
                      <>
                        <button className="btn-primary !py-1 !px-2 !text-[11px]"
                          onClick={() => {
                            try {
                              if (!editBody.trim()) throw new Error('Note text cannot be empty.');
                              actions.updateNote(n.id, editBody.trim());
                              setEditingId(null);
                            } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
                          }}>Save</button>
                        <button className="btn-ghost !py-1 !px-2 !text-[11px]" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-secondary !py-1 !px-2 !text-[11px]" disabled={closed}
                          title={closed ? 'This inspection is read-only.' : `Edit ${n.id}.`}
                          onClick={() => { setEditingId(n.id); setEditBody(n.body); }}>
                          <Pencil size={12} className="inline mr-0.5" />Edit
                        </button>
                        <button className="btn-ghost !py-1 !px-2 !text-[11px] text-red-600" disabled={!n.draft}
                          title={n.draft ? `Delete draft ${n.id}.` : 'Only draft notes can be deleted — published notes are kept as part of the record.'}
                          onClick={() => {
                            try { actions.deleteNote(n.id); } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
                          }}>
                          <Trash2 size={12} className="inline mr-0.5" />Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingId === n.id ? (
                  <textarea className="input mt-2" rows={3} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-slate-700 whitespace-pre-wrap">{n.body}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function AddEvidenceModal({ inspectionId, itemId, presetType, onClose, onError }: {
  inspectionId: string;
  itemId: string | null;
  presetType?: EvidenceType;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const inspection = inspectionOf(db, inspectionId)!;
  const items = itemsOf(db, inspection.templateId);
  const [type, setType] = useState<EvidenceType>(presetType ?? 'Photo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(inspection.location);
  const [linkedItem, setLinkedItem] = useState<string>(itemId ?? '');
  const [fileIdx, setFileIdx] = useState(0);
  const [localError, setLocalError] = useState('');

  const submit = () => {
    try {
      const file = SAMPLE_FILES[fileIdx];
      const id = actions.addEvidence({
        inspectionId,
        itemId: linkedItem || null,
        type,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        fileRef: `DEMO-FILE://${file.name}`,
        fileName: file.name,
        sizeKb: file.sizeKb,
      });
      onClose();
      return id;
    } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal title="Add evidence" onClose={onClose} wide>
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11.5px] text-sky-800 mb-3">
        DEMO record — a synthetic sample file reference is stored. Nothing is uploaded and no real file leaves this page.
      </div>
      {localError && <InlineError error={localError} onDismiss={() => setLocalError('')} />}
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Evidence type">
          <select className="input" value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
            {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Linked checklist item" hint="Optional — links this record to a specific check.">
          <select className="input" value={linkedItem} onChange={(e) => setLinkedItem(e.target.value)}>
            <option value="">No linked item</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.requirement.slice(0, 60)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Haul road berm washed out at chainage 1.2 km" /></Field>
      <Field label="Description"><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this record shows and why it matters…" /></Field>
      <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label="Sample file" hint="Synthetic reference — this demo never uploads a real file.">
        <select className="input" value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
          {SAMPLE_FILES.map((f, i) => <option key={f.name} value={i}>{f.label} · {f.name} · {fmtSize(f.sizeKb * 1024)}</option>)}
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={!title.trim() || !description.trim()}
          title={!title.trim() || !description.trim() ? 'Title and description are required.' : 'Save this evidence record.'}>
          <Plus size={14} className="inline mr-1" />Add evidence
        </button>
      </div>
    </Modal>
  );
}

function ViewEvidenceModal({ evidence, inspection, items, canEdit, onClose, onError }: {
  evidence: ReturnType<typeof evidenceFor>[number];
  inspection: Inspection;
  items: ReturnType<typeof itemsOf>;
  canEdit: boolean;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState(evidence.title);
  const [description, setDescription] = useState(evidence.description);
  const [linkedItem, setLinkedItem] = useState(evidence.itemId ?? '');
  const [dirty, setDirty] = useState(false);
  const item = items.find((i) => i.id === evidence.itemId);

  return (
    <Modal title={`${evidence.id} · ${evidence.type}`} onClose={onClose} wide>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600 mb-3">
        Attached to <b>{inspection.id}</b> — {inspection.title}. DEMO file reference; no real asset is fetched.
      </div>
      <Field label="Title">
        <input className="input" value={title} disabled={!canEdit}
          title={canEdit ? undefined : 'This inspection is read-only — evidence cannot be edited.'}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
      </Field>
      <Field label="Description">
        <textarea className="input" rows={3} value={description} disabled={!canEdit}
          title={canEdit ? undefined : 'This inspection is read-only — evidence cannot be edited.'}
          onChange={(e) => { setDescription(e.target.value); setDirty(true); }} />
      </Field>
      <Field label="Linked checklist item">
        <select className="input" value={linkedItem} disabled={!canEdit}
          title={canEdit ? undefined : 'This inspection is read-only.'}
          onChange={(e) => { setLinkedItem(e.target.value); setDirty(true); }}>
          <option value="">No linked item</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.requirement.slice(0, 60)}</option>)}
        </select>
      </Field>
      {item && (
        <div className="rounded-xl border border-slate-200 px-3 py-2 text-[12px]">
          <div className="font-bold text-navy">{item.requirement}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">{item.description}</div>
        </div>
      )}
      <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
        <div><dt className="text-slate-400 inline">File: </dt><dd className="inline font-semibold text-navy">{evidence.fileName} · {fmtSize(evidence.sizeKb * 1024)}</dd></div>
        <div><dt className="text-slate-400 inline">Captured: </dt><dd className="inline font-semibold text-navy">{fmtDateTime(evidence.capturedAt)}</dd></div>
        <div><dt className="text-slate-400 inline">Location: </dt><dd className="inline font-semibold text-navy">{evidence.location}</dd></div>
        <div><dt className="text-slate-400 inline">Uploaded by: </dt><dd className="inline font-semibold text-navy">{evidence.uploadedBy}</dd></div>
        <div className="sm:col-span-2"><dt className="text-slate-400 inline">Reference: </dt><dd className="inline font-mono text-[11px] text-slate-500">{evidence.fileRef}</dd></div>
      </dl>
      <div className="flex justify-end gap-2 pt-3">
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" disabled={!canEdit || !dirty || !title.trim()}
          title={!canEdit ? 'This inspection is read-only.' : !dirty ? 'No unsaved changes.' : !title.trim() ? 'Title is required.' : 'Save the changes to this evidence record.'}
          onClick={() => {
            try {
              actions.updateEvidence(evidence.id, { title: title.trim(), description: description.trim() });
              if ((evidence.itemId ?? '') !== linkedItem) actions.linkEvidence(evidence.id, linkedItem || null);
              onClose();
            } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
          }}>
          <Save size={14} className="inline mr-1" />Save changes
        </button>
      </div>
    </Modal>
  );
}

function CreateFindingModal({ inspectionId, itemId, onClose, onError }: {
  inspectionId: string; itemId: string | null; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const inspection = inspectionOf(db, inspectionId)!;
  const items = itemsOf(db, inspection.templateId);
  const [category, setCategory] = useState<FindingCategory>(FindingCategory.Safety);
  const [severity, setSeverity] = useState<Severity>(Severity.Medium);
  const [linkedItem, setLinkedItem] = useState(itemId ?? '');
  const [description, setDescription] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [assignee, setAssignee] = useState('Mine Manager');
  const [localError, setLocalError] = useState('');

  return (
    <Modal title="Create finding" onClose={onClose} wide>
      {localError && <InlineError error={localError} onDismiss={() => setLocalError('')} />}
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Category">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as FindingCategory)}>
            {CATEGORY_VALUES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Severity" hint="Critical and High findings drive the corrective-action workflow.">
          <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
            {SEVERITY_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Linked checklist item" hint="Optional.">
        <select className="input" value={linkedItem} onChange={(e) => setLinkedItem(e.target.value)}>
          <option value="">No linked item</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.id} — {i.requirement.slice(0, 60)}</option>)}
        </select>
      </Field>
      <Field label="Description" hint="What was observed and why it is a problem.">
        <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Recommendation" hint="The corrective action you are asking the mine to take.">
        <textarea className="input" rows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
      </Field>
      <Field label="Assignee"><input className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!description.trim() || !recommendation.trim()}
          title={!description.trim() || !recommendation.trim() ? 'A description and a recommendation are required.' : 'Raise this finding against the inspection.'}
          onClick={() => {
            try {
              actions.createFinding({
                inspectionId, itemId: linkedItem || null, category, severity,
                description: description.trim(), recommendation: recommendation.trim(),
                assignee: assignee.trim(),
              });
              onClose();
            } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
          }}>
          <TriangleAlert size={14} className="inline mr-1" />Create finding
        </button>
      </div>
    </Modal>
  );
}

function AttachDocumentModal({ inspectionId, onClose, onError }: {
  inspectionId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Safety SOP' as DocumentCategory);
  const [fileIdx, setFileIdx] = useState(0);
  const [localError, setLocalError] = useState('');
  const files = [
    { name: 'safety-sop-2026.pdf', sizeKb: 640 },
    { name: 'mine-layout-bcm.pdf', sizeKb: 1280 },
    { name: 'equipment-checklist.xlsx', sizeKb: 96 },
    { name: 'permit-to-work.pdf', sizeKb: 210 },
  ];

  return (
    <Modal title="Attach document" onClose={onClose}>
      {localError && <InlineError error={localError} onDismiss={() => setLocalError('')} />}
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11.5px] text-sky-800 mb-3">
        DEMO record — a synthetic sample file is referenced. No real file is uploaded.
      </div>
      <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monsoon preparedness plan" /></Field>
      <Field label="Category">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
          {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Sample file">
        <select className="input" value={fileIdx} onChange={(e) => setFileIdx(Number(e.target.value))}>
          {files.map((f, i) => <option key={f.name} value={i}>{f.name} · {fmtSize(f.sizeKb * 1024)}</option>)}
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!title.trim()}
          title={!title.trim() ? 'A title is required.' : 'Attach this document to the inspection.'}
          onClick={() => {
            try {
              const f = files[fileIdx];
              actions.attachDocument(inspectionId, { title: title.trim(), category, fileName: f.name, sizeKb: f.sizeKb });
              onClose();
            } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
          }}>
          <Upload size={14} className="inline mr-1" />Attach
        </button>
      </div>
    </Modal>
  );
}

function ViewDocumentModal({ doc, onClose, onError }: {
  doc: ReturnType<typeof documentsFor>[number]; onClose: () => void; onError: (m: string) => void;
}) {
  return (
    <Modal title={`${doc.id} · ${doc.title}`} onClose={onClose} wide>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11.5px] text-slate-600 mb-3">
        <span className="badge bg-amber-100 text-amber-700 !text-[10px] mr-1.5">DEMO SAMPLE</span>
        Synthetic contents rendered in the browser — no real file is fetched.
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] mb-3">
        <div><dt className="text-slate-400 inline">Category: </dt><dd className="inline font-semibold text-navy">{doc.category}</dd></div>
        <div><dt className="text-slate-400 inline">File: </dt><dd className="inline font-semibold text-navy">{doc.fileName} · {fmtSize(doc.sizeKb * 1024)}</dd></div>
        <div><dt className="text-slate-400 inline">Updated: </dt><dd className="inline font-semibold text-navy">{fmtDateTime(doc.updatedAt)}</dd></div>
        <div><dt className="text-slate-400 inline">Owner: </dt><dd className="inline font-semibold text-navy">{doc.owner}</dd></div>
      </dl>
      <pre className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11.5px] text-slate-700 whitespace-pre-wrap max-h-72 overflow-y-auto">
        {sampleDocumentBody(doc)}
      </pre>
      <div className="flex justify-end gap-2 pt-3">
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={() => {
          try {
            const { downloadDocument } = require('../../lib/inspections/export') as typeof import('../../lib/inspections/export');
            downloadDocument(doc.title, doc.fileName, sampleDocumentBody(doc));
          } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
        }}>
          <FileText size={14} className="inline mr-1" />Download
        </button>
      </div>
    </Modal>
  );
}

function CompareModal({ inspectionId, onClose }: { inspectionId: string; onClose: () => void }) {
  const db = useMockInspections();
  const rows = compareWithPrevious(db, inspectionId);
  const tone = (c: string) => c === 'Improved' ? 'bg-emerald-100 text-emerald-700'
    : c === 'Declined' ? 'bg-red-100 text-red-600'
    : c === 'New Check' ? 'bg-sky-100 text-sky-700'
    : c === 'Unchanged' ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400';
  return (
    <Modal title="Compare with previous inspection" onClose={onClose} wide>
      <p className="text-[12px] text-slate-600 mb-3">
        Each requirement is compared against the most recent completed inspection of the same type at this mine.
        A change is shown as <b>Improved</b> or <b>Declined</b> only when both sides have a definitive answer.
      </p>
      {rows.length === 0 ? (
        <EmptyState title="Nothing to compare yet" sub="Complete a second inspection of this type at this mine to enable comparison." />
      ) : (
        <div className="overflow-x-auto">
          <table className="dense min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3">Requirement</th><th className="py-2 pr-3">Previous</th>
                <th className="py-2 pr-3">Current</th><th className="py-2 pr-3">Change</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-navy">{r.requirement}</td>
                  <td className="py-2 pr-3"><ResponseChip v={r.previous} size="xs" /></td>
                  <td className="py-2 pr-3"><ResponseChip v={r.current} size="xs" /></td>
                  <td className="py-2 pr-3"><span className={`badge !text-[10px] ${tone(r.change)}`}>{r.change}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end pt-3"><button className="btn-secondary" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

function ViewReportModal({ reportId, onClose, onError }: {
  reportId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const report = db.reports.find((r) => r.id === reportId);
  if (!report) return null;
  const inspection = inspectionOf(db, report.inspectionId);
  const site = siteOf(db, report.mineId);

  const download = () => {
    try {
      downloadReport(report, {
        mineLabel: site ? siteLabel(db, report.mineId) : report.mineId,
        inspector: db.inspectors.find((x) => x.id === report.inspectorId)?.name ?? report.inspectorId,
        scheduledDate: inspection?.scheduledDate ?? report.submittedAt.slice(0, 10),
        type: report.type, title: report.title,
      });
      actions.logDownload(report.inspectionId, 'report', `${report.id} — ${report.title}`);
    } catch (e) { onError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Modal title={`${report.id} · ${report.title}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <StatusChip v={report.status} />
        <span className="badge bg-slate-100 text-slate-600 !text-[10px]">Version {report.version}</span>
        <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{report.type}</span>
        <span className="ml-auto text-[11px] text-slate-400">Generated on submission · DEMO</span>
      </div>
      <p className="text-[12.5px] text-slate-700">{report.summary}</p>
      <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          ['Compliant', report.counts.compliant, 'text-emerald-600'],
          ['Non-compliant', report.counts.nonCompliant, 'text-red-600'],
          ['Not applicable', report.counts.notApplicable, 'text-slate-500'],
          ['Not checked', report.counts.notChecked, 'text-amber-600'],
          ['Evidence', report.counts.evidence, 'text-sky-600'],
          ['Findings', report.counts.findings, 'text-amber-600'],
        ].map(([l, v, tone]) => (
          <div key={String(l)} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{l}</div>
            <div className={`text-[15px] font-extrabold ${tone}`}>{v}</div>
          </div>
        ))}
      </div>
      <dl className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
        <div><dt className="text-slate-400 inline">Mine: </dt><dd className="inline font-semibold text-navy">{site ? `${site.code} · ${site.name}` : report.mineId}</dd></div>
        <div><dt className="text-slate-400 inline">Inspector: </dt><dd className="inline font-semibold text-navy">{db.inspectors.find((x) => x.id === report.inspectorId)?.name ?? report.inspectorId}</dd></div>
        <div><dt className="text-slate-400 inline">Submitted: </dt><dd className="inline font-semibold text-navy">{fmtDateTime(report.submittedAt)}</dd></div>
        <div><dt className="text-slate-400 inline">Inspection: </dt><dd className="inline font-semibold text-navy">{report.inspectionId}</dd></div>
      </dl>
      <div className="flex justify-end gap-2 pt-3">
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={download}><FileText size={14} className="inline mr-1" />Download</button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Schedule dialogs
// ---------------------------------------------------------------------------

function CancelDialog({ inspectionId, onClose, onError }: {
  inspectionId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const inspection = inspectionOf(db, inspectionId)!;
  const perms = rolePermissions(db);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');
  const direct = perms.canCancel;

  return (
    <Modal title={`Cancel ${inspection.id}`} onClose={onClose}>
      <div className={`rounded-xl border px-3 py-2 text-[11.5px] mb-3 ${direct ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
        {direct
          ? 'Your demo role can cancel this inspection directly. The record becomes Cancelled immediately.'
          : 'Your demo role cannot cancel directly — this files a Pending Approval request for a supervisory role to decide.'}
      </div>
      {localError && <InlineError error={localError} onDismiss={() => setLocalError('')} />}
      <Field label="Reason" hint="Required. Explain why the inspection is being cancelled.">
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Keep inspection</button>
        <button className="btn-primary !bg-red-600 hover:!bg-red-700" disabled={!reason.trim()}
          title={!reason.trim() ? 'A reason is required.' : direct ? 'Cancel this inspection now.' : 'File a cancellation request.'}
          onClick={() => {
            try {
              if (direct) actions.cancelInspection(inspectionId, reason.trim());
              else actions.requestCancel(inspectionId, reason.trim());
              onClose();
            } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
          }}>
          {direct ? 'Cancel inspection' : 'Request cancellation'}
        </button>
      </div>
    </Modal>
  );
}

function RescheduleDialog({ inspectionId, onClose, onError }: {
  inspectionId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const inspection = inspectionOf(db, inspectionId)!;
  const perms = rolePermissions(db);
  const [toDate, setToDate] = useState(inspection.scheduledDate);
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');
  const direct = perms.canReschedule;

  return (
    <Modal title={`Reschedule ${inspection.id}`} onClose={onClose}>
      <div className={`rounded-xl border px-3 py-2 text-[11.5px] mb-3 ${direct ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
        {direct
          ? 'Your demo role can move the date directly. The schedule and this record update immediately.'
          : 'Your demo role cannot reschedule directly — this files a Pending Approval request. The record is unchanged until it is approved.'}
      </div>
      {localError && <InlineError error={localError} onDismiss={() => setLocalError('')} />}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] mb-3">
        Currently scheduled <b>{fmtDate(inspection.scheduledDate)}</b> ({weekdayLong(inspection.scheduledDate)}) · today is {fmtDate(DEMO_TODAY)}.
      </div>
      <Field label="New date"><input type="date" className="input" min={DEMO_TODAY} value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field>
      <Field label="Reason" hint="Required for the approval record.">
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!reason.trim() || toDate === inspection.scheduledDate}
          title={!reason.trim() ? 'A reason is required.' : toDate === inspection.scheduledDate ? 'Pick a different date.' : direct ? 'Move this inspection now.' : 'File a reschedule request.'}
          onClick={() => {
            try {
              const res = actions.requestReschedule(inspectionId, toDate, reason.trim());
              if (!res.applied) { onError(`Request ${res.requestId} filed for approval — the record is unchanged until a supervisory role approves it.`); }
              onClose();
            } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
          }}>
          {direct ? 'Reschedule' : 'Request reschedule'}
        </button>
      </div>
    </Modal>
  );
}

function ReassignDialog({ inspectionId, onClose, onError }: {
  inspectionId: string; onClose: () => void; onError: (m: string) => void;
}) {
  const db = useMockInspections();
  const inspection = inspectionOf(db, inspectionId)!;
  const perms = rolePermissions(db);
  const [toInspector, setToInspector] = useState('');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState('');
  const direct = perms.canReassign;

  return (
    <Modal title={`Reassign ${inspection.id}`} onClose={onClose}>
      <div className={`rounded-xl border px-3 py-2 text-[11.5px] mb-3 ${direct ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
        {direct
          ? 'Your demo role can reassign directly. The assignment and schedule update immediately.'
          : 'Your demo role cannot reassign directly — this files a Pending Approval request for a supervisory role to decide.'}
      </div>
      {localError && <InlineError error={localError} onDismiss={() => setLocalError('')} />}
      <Field label="New inspector">
        <select className="input" value={toInspector} onChange={(e) => setToInspector(e.target.value)}>
          <option value="">Select an inspector…</option>
          {db.inspectors.filter((x) => x.id !== inspection.assignedTo).map((x) => (
            <option key={x.id} value={x.id}>{x.name} · {x.designation}</option>
          ))}
        </select>
      </Field>
      <Field label="Reason" hint="Required for the approval record.">
        <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!toInspector || !reason.trim()}
          title={!toInspector ? 'Choose an inspector.' : !reason.trim() ? 'A reason is required.' : direct ? 'Reassign this inspection now.' : 'File a reassignment request.'}
          onClick={() => {
            try {
              const res = actions.requestReassign(inspectionId, toInspector, reason.trim());
              if (!res.applied) { onError(`Request ${res.requestId} filed for approval — the assignment is unchanged until a supervisory role approves it.`); }
              onClose();
            } catch (e) { setLocalError(e instanceof Error ? e.message : String(e)); }
          }}>
          {direct ? 'Reassign' : 'Request reassignment'}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleDocumentBody(d: { id: string; title: string; category: string; fileName: string }): string {
  return [
    'MINE NETR — SYNTHETIC DEMO DOCUMENT',
    '===================================',
    '',
    `Document ID   : ${d.id}`,
    `Title         : ${d.title}`,
    `Category      : ${d.category}`,
    `File name     : ${d.fileName}`,
    '',
    'This file is a synthetic sample generated for demonstration purposes.',
    'It is NOT an original record, NOT a statutory register and NOT a DGMS',
    'submission. No real mine document is stored or fetched by this page.',
    '',
    '--- SAMPLE CONTENT ---',
    '',
    '1. Scope',
    '   Applies to the opencast working, haul roads, crushing and dispatch',
    '   sections covered by the associated inspection.',
    '',
    '2. Control',
    '   The shift supervisor is responsible for verifying that the controls',
    '   listed in the associated checklist are in place before work begins.',
    '',
    '3. Review',
    '   Reviewed at the start of each shift and after any monsoon, blasting',
    '   or equipment-change event.',
    '',
    '4. Records',
    '   Retention: 24 months (demonstration value only).',
  ].join('\n');
}
