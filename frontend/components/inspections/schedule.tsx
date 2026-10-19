/**
 * Inspection Schedule (reference page 4).
 *
 * Deliberately NOT a second schedule system: every entry here is derived from
 * the shared inspection records, so starting, rescheduling, reassigning or
 * cancelling an inspection in My Inspections changes this calendar immediately
 * — and vice versa.
 */
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays, ChevronLeft, ChevronRight, Download, ExternalLink, ListChecks,
  MapPin, RotateCcw, UserCog, X,
} from 'lucide-react';
import { EmptyState, Field, Modal, SectionCard } from '../operations/ui';
import {
  ChecklistMeter, InlineError, Menu, NavBtn, PermBtn, PriorityChip, StatusChip,
} from './ui';
import {
  actions, checklistFor, scheduleEntries, useMockInspections,
} from '../../lib/inspections/store';
import {
  DEMO_TODAY, type ScheduleEntry,
} from '../../lib/inspections/types';
import {
  addDays, demoDate, fmtDate, fmtTime, monthLabel, monthMatrix, weekdayLong,
} from '../../lib/inspections/format';
import { downloadScheduleCsv } from '../../lib/inspections/export';

export function ScheduleCalendar() {
  const db = useMockInspections();
  const [year, setYear] = useState(() => Number(DEMO_TODAY.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(DEMO_TODAY.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateDialog, setDateDialog] = useState<{ id: string; kind: 'change' | 'reschedule' } | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const monthKeyStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const cells = useMemo(() => monthMatrix(year, month), [year, month]);
  const monthEntries = useMemo(() => scheduleEntries(db, monthKeyStr), [db, monthKeyStr]);

  const visible = useMemo(() => {
    let list = monthEntries;
    if (typeFilter !== 'ALL') list = list.filter((e) => e.inspection.type === typeFilter);
    if (selectedDate) {
      const onDate = list.filter((e) => e.date === selectedDate);
      // Keep the selected date on top rather than hiding the rest of the month.
      return [...onDate, ...list.filter((e) => e.date !== selectedDate)];
    }
    return list;
  }, [monthEntries, typeFilter, selectedDate]);

  const upcoming = useMemo(() => scheduleEntries(db)
    .filter((e) => e.date >= DEMO_TODAY)
    .filter((e) => (typeFilter === 'ALL' ? true : e.inspection.type === typeFilter))
    .slice(0, 40), [db, typeFilter]);

  const listSource = selectedDate ? visible.filter((e) => e.date === selectedDate) : upcoming;
  const selected = selectedId ? visible.find((e) => e.inspection.id === selectedId) ?? null : null;

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduleEntry[]>();
    for (const e of monthEntries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [monthEntries]);

  function shift(delta: number) {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth());
    setSelectedDate(null);
    setSelectedId(null);
  }

  function handleActionError(e: unknown) {
    setError(e instanceof Error ? e.message : 'That action could not be completed.');
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft size={14} className="inline" /> Prev
        </button>
        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 text-[13px] font-extrabold">
          <CalendarDays size={14} /> {monthLabel(monthKeyStr)}
        </span>
        <button className="btn-secondary !py-1.5 !px-3 !text-[12px]" onClick={() => shift(1)} aria-label="Next month">
          Next <ChevronRight size={14} className="inline" />
        </button>
        <button
          className="btn-ghost !py-1.5 !text-[12px]"
          onClick={() => {
            const d = demoDate();
            setYear(Number(d.slice(0, 4)));
            setMonth(Number(d.slice(5, 7)) - 1);
            setSelectedDate(d);
          }}
        >
          <RotateCcw size={13} className="inline mr-1" /> Today
        </button>

        <select className="input !w-64 !py-1.5 !text-[12px]" value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by inspection type">
          <option value="ALL">All inspection types</option>
          {[...new Set(db.inspections.map((i) => i.type))].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {selectedDate && (
          <button className="btn-ghost !py-1.5 !text-[12px]" onClick={() => { setSelectedDate(null); setSelectedId(null); }}>
            <X size={13} className="inline mr-1" /> Clear date
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <PermBtn perm="canStart" onClick={() => {
            setError('');
            const rows = selectedDate ? visible.filter((e) => e.date === selectedDate) : upcoming;
            if (rows.length === 0) { setError('There are no schedule entries to export for this view.'); return; }
            downloadScheduleCsv(rows, `inspection-schedule-${monthKeyStr}.csv`);
          }} className="btn-secondary !py-1.5 !px-3 !text-[12px]">
            <span className="flex items-center gap-1.5"><Download size={13} /> Export schedule</span>
          </PermBtn>
        </div>
      </div>

      <InlineError error={error} onDismiss={() => setError('')} />

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="xl:col-span-2">
          <SectionCard
            title={`${monthLabel(monthKeyStr)} calendar`}
            subtitle={`${monthEntries.length} inspection${monthEntries.length === 1 ? '' : ' scheduled'}${selectedDate ? ` · viewing ${fmtDate(selectedDate)}` : ''}`}
          >
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-[11px] font-bold text-slate-500 uppercase tracking-wide py-1">{d}</div>
              ))}
              {cells.map((c) => {
                const events = (byDate.get(c.date) ?? [])
                  .filter((e) => typeFilter === 'ALL' || e.inspection.type === typeFilter);
                const isToday = c.date === DEMO_TODAY;
                const isSelected = c.date === selectedDate;
                return (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(isSelected ? null : c.date);
                      setSelectedId(null);
                    }}
                    aria-pressed={isSelected}
                    className={`min-h-[74px] rounded-xl border p-1.5 text-left transition
                      ${isSelected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50/70'
                        : isToday ? 'border-blue-300 bg-blue-50/50'
                          : c.inMonth ? 'border-slate-200 bg-white hover:border-blue-200'
                            : 'border-slate-100 bg-slate-50/70'}`}
                  >
                    <div className={`text-[11.5px] font-bold ${isToday ? 'text-blue-700' : c.inMonth ? 'text-navy' : 'text-slate-400'}`}>
                      {c.day}
                      {isToday && <span className="ml-1 text-[9px] uppercase text-blue-600">today</span>}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {events.slice(0, 2).map((e) => (
                        <div key={e.inspection.id}
                          className={`truncate rounded px-1 py-0.5 text-[9.5px] font-bold
                            ${e.effectiveStatus === 'Overdue' ? 'bg-red-100 text-red-700'
                              : e.effectiveStatus === 'Completed' ? 'bg-emerald-100 text-emerald-700'
                                : e.effectiveStatus === 'Cancelled' ? 'bg-slate-200 text-slate-500'
                                  : e.effectiveStatus === 'In Progress' || e.effectiveStatus === 'Pending Submission' ? 'bg-sky-100 text-sky-700'
                                    : 'bg-blue-100 text-blue-700'}`}
                          title={`${e.inspection.id} · ${e.inspection.type}`}>
                          {e.site.code} {e.inspection.type.split(' ')[0]}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <div className="text-[9.5px] text-slate-500 font-semibold">+{events.length - 2} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-500">
              <span>🟦 Upcoming</span><span>🟧 In progress / pending</span>
              <span>🟥 Overdue</span><span>🟩 Completed</span>
              <span className="ml-auto">Select a date to filter the list below.</span>
            </div>
          </SectionCard>
        </div>

        {/* Schedule details */}
        <div className="xl:col-span-1">
          <SectionCard
            title="Schedule details"
            subtitle={selected ? selected.inspection.id : 'Select an inspection from the list'}
          >
            {!selected ? (
              <EmptyState
                title="No inspection selected"
                sub="Pick an entry from the scheduled inspections list to see its details, checklist progress and schedule actions."
              />
            ) : (
              <ScheduleDetails
                entry={selected}
                onChangeDate={() => setDateDialog({ id: selected.inspection.id, kind: 'change' })}
                onRequestReschedule={() => setDateDialog({ id: selected.inspection.id, kind: 'reschedule' })}
                onCancel={() => setCancelId(selected.inspection.id)}
                onError={handleActionError}
              />
            )}
          </SectionCard>
        </div>
      </div>

      {/* List */}
      <SectionCard
        title={selectedDate ? `Scheduled on ${fmtDate(selectedDate)} (${weekdayLong(selectedDate)})` : 'Upcoming scheduled inspections'}
        subtitle={`${listSource.length} entr${listSource.length === 1 ? 'y' : 'ies'}${typeFilter !== 'ALL' ? ` · ${typeFilter}` : ''} · derived from the shared inspection records`}
        action={selectedDate ? (
          <button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => { setSelectedDate(null); setSelectedId(null); }}>
            Show all upcoming
          </button>
        ) : undefined}
      >
        {listSource.length === 0 ? (
          <EmptyState
            title={selectedDate ? 'No inspections are scheduled on this date.' : 'No upcoming inspections match this filter.'}
            sub={selectedDate ? 'Pick another date, or clear the date filter to see the rest of the month.' : 'Try a different inspection type.'}
            action={selectedDate
              ? <button className="btn-primary !py-2" onClick={() => setSelectedDate(null)}>Clear date</button>
              : <button className="btn-primary !py-2" onClick={() => setTypeFilter('ALL')}>Clear filters</button>}
          />
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="dense w-full min-w-[820px]">
              <thead>
                <tr>
                  <th>Date</th><th>Time</th><th>Inspection</th><th>Mine / Location</th>
                  <th>Type</th><th>Priority</th><th>Status</th><th>Inspector</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listSource.map((e) => (
                  <tr key={e.inspection.id}
                    className={`cursor-pointer hover:bg-blue-50/50 ${selectedId === e.inspection.id ? 'bg-blue-50/70' : ''}`}
                    onClick={() => setSelectedId(e.inspection.id)}>
                    <td className="font-bold text-navy whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="whitespace-nowrap text-slate-600">{fmtTime(e.inspection.startTime)}–{fmtTime(e.inspection.endTime)}</td>
                    <td>
                      <div className="font-bold text-navy">{e.inspection.id}</div>
                      <div className="text-[11.5px] text-slate-500 line-clamp-1">{e.inspection.title}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-navy">{e.site.code}</div>
                      <div className="text-[11.5px] text-slate-500">{e.inspection.location}</div>
                    </td>
                    <td className="text-[12.5px]">{e.inspection.type}</td>
                    <td><PriorityChip v={e.inspection.priority} /></td>
                    <td><StatusChip v={e.effectiveStatus} /></td>
                    <td className="text-[12.5px] whitespace-nowrap">{e.inspectorName}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Link href={`/inspector/inspections/${e.inspection.id}`}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-navy hover:border-blue-300 hover:bg-blue-50"
                          title="View scheduled inspection" aria-label={`View ${e.inspection.id}`}>
                          <ExternalLink size={14} />
                        </Link>
                        <Menu label="" items={[
                          {
                            label: 'View inspection', icon: <ExternalLink size={13} />,
                            onClick: () => setSelectedId(e.inspection.id),
                          },
                          {
                            label: e.date >= DEMO_TODAY ? 'Change date' : 'Request reschedule',
                            icon: <CalendarDays size={13} />,
                            disabled: e.effectiveStatus === 'Completed' || e.effectiveStatus === 'Cancelled',
                            title: e.effectiveStatus === 'Completed'
                              ? 'A completed inspection cannot be rescheduled.'
                              : 'Move this inspection to another date.',
                            onClick: () => setDateDialog({ id: e.inspection.id, kind: e.date >= DEMO_TODAY ? 'change' : 'reschedule' }),
                          },
                          {
                            label: 'Request reassignment', icon: <UserCog size={13} />,
                            disabled: e.effectiveStatus === 'Completed' || e.effectiveStatus === 'Cancelled',
                            onClick: () => setDateDialog({ id: e.inspection.id, kind: 'reschedule' }),
                          },
                          {
                            label: 'Cancel inspection', icon: <X size={13} />, danger: true,
                            disabled: e.effectiveStatus === 'Completed' || e.effectiveStatus === 'Cancelled',
                            title: 'Cancelled inspections stay visible in the schedule for the record.',
                            onClick: () => setCancelId(e.inspection.id),
                          },
                        ]} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {dateDialog && (
        <DateDialog
          entryId={dateDialog.id}
          kind={dateDialog.kind}
          onClose={() => setDateDialog(null)}
          onError={handleActionError}
        />
      )}
      {cancelId && (
        <CancelDialog entryId={cancelId} onClose={() => setCancelId(null)} onError={handleActionError} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ScheduleDetails({ entry, onChangeDate, onRequestReschedule, onCancel, onError }: {
  entry: ScheduleEntry;
  onChangeDate: () => void;
  onRequestReschedule: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const db = useMockInspections();
  const progress = checklistFor(db, entry.inspection.id);
  const done = entry.effectiveStatus === 'Completed';
  const closed = done || entry.effectiveStatus === 'Cancelled';

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/60">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-extrabold text-navy">{entry.inspection.id}</div>
            <div className="text-[12px] text-slate-600 line-clamp-2">{entry.inspection.title}</div>
          </div>
          <StatusChip v={entry.effectiveStatus} />
        </div>
        <dl className="mt-2.5 space-y-1.5 text-[12px]">
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Date</dt>
            <dd className="font-semibold text-navy">{fmtDate(entry.date)} · {weekdayLong(entry.date)}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Time</dt>
            <dd className="font-semibold text-navy">{fmtTime(entry.inspection.startTime)}–{fmtTime(entry.inspection.endTime)}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Mine</dt>
            <dd className="font-semibold text-navy">{entry.site.code} · {entry.site.name}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Location</dt>
            <dd className="font-semibold text-navy">{entry.inspection.location}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Type</dt>
            <dd className="font-semibold text-navy">{entry.inspection.type}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Priority</dt>
            <dd><PriorityChip v={entry.inspection.priority} /></dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Inspector</dt>
            <dd className="font-semibold text-navy">{entry.inspectorName}</dd></div>
          <div className="flex gap-2"><dt className="text-slate-500 w-24 shrink-0">Zone</dt>
            <dd className="font-semibold text-navy flex items-center gap-1"><MapPin size={12} className="text-blue-600" /> {entry.site.area}</dd></div>
        </dl>
      </div>

      <ChecklistMeter p={progress} />

      <div className="grid grid-cols-2 gap-2">
        <PermBtn perm="canStart" onClick={() => {
          try { onChangeDate(); } catch (e) { onError(e instanceof Error ? e.message : ''); }
        }} className="btn-secondary !py-2 !text-[12px] !col-span-1" disabled={closed}
          title={closed ? 'Completed and cancelled inspections keep their original date.' : undefined}>
          <span className="flex items-center gap-1.5"><CalendarDays size={13} /> Change date</span>
        </PermBtn>
        <PermBtn perm="canReschedule" onClick={onRequestReschedule} className="btn-secondary !py-2 !text-[12px]" disabled={closed}
          title={closed ? 'This inspection can no longer be rescheduled.' : 'Supervisory roles reschedule directly; inspectors submit a request.'}>
          <span className="flex items-center gap-1.5"><RotateCcw size={13} /> Reschedule</span>
        </PermBtn>
      </div>

      <div className="flex flex-wrap gap-2">
        <NavBtn href={`/inspector/inspections/${entry.inspection.id}`} icon={<ExternalLink size={13} />}>
          {entry.effectiveStatus === 'Upcoming' ? 'View scheduled inspection' : 'Open inspection'}
        </NavBtn>
        <NavBtn href={`/inspector/inspections/${entry.inspection.id}?tab=Inspection%20Checklist`} icon={<ListChecks size={13} />}>
          Open checklist
        </NavBtn>
      </div>

      <PermBtn perm="canCancel" onClick={() => { try { onCancel(); } catch (e) { onError(e instanceof Error ? e.message : ''); } }}
        className="w-full !py-2 !text-[12px] border !border-red-200 !bg-white !text-red-600 hover:!bg-red-50 font-semibold rounded-xl transition disabled:opacity-50"
        disabled={closed}
        title={done ? 'A completed inspection cannot be cancelled.' : 'Requires a supervisory demo role.'}>
        Cancel inspection
      </PermBtn>
      {!closed && (
        <p className="text-[11px] text-slate-400">
          {entry.date >= DEMO_TODAY
            ? 'Future-dated inspections can be moved directly by a supervisory role; otherwise a pending request is created.'
            : 'This date has passed — a reschedule request will be raised for approval.'}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function DateDialog({ entryId, kind, onClose, onError }: {
  entryId: string; kind: 'change' | 'reschedule'; onClose: () => void; onError: (msg: string) => void;
}) {
  const db = useMockInspections();
  const entry = scheduleEntries(db).find((e) => e.inspection.id === entryId);
  const [date, setDate] = useState(entry ? (entry.date >= DEMO_TODAY ? addDays(entry.date, 7) : DEMO_TODAY) : DEMO_TODAY);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const inspectorMode = !['Senior Labour Officer', 'Mine Admin'].includes(db.role);

  const dateError = touched && (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    ? 'Choose a valid new date.' : undefined;
  const reasonError = touched && !reason.trim() ? 'A reason is required.' : undefined;

  function submit() {
    setTouched(true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !reason.trim()) return;
    try {
      actions.requestReschedule(entryId, date, reason);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not update the schedule.');
      onClose();
    }
  }

  return (
    <Modal title={kind === 'change' ? `Change date · ${entryId}` : `Request reschedule · ${entryId}`} onClose={onClose}>
      <div className="space-y-3">
        {entry && (
          <p className="text-[12px] text-slate-600">
            Current slot: <b>{fmtDate(entry.date)} · {fmtTime(entry.inspection.startTime)}–{fmtTime(entry.inspection.endTime)}</b>
            {' — '}{entry.site.code} {entry.site.name}, {entry.inspection.location}.
          </p>
        )}
        <Field label="New date" error={dateError}>
          <input type="date" className="input" value={date} min={DEMO_TODAY} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Reason" error={reasonError} hint="Recorded against the inspection activity timeline.">
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Blasting programme moved to the 13th, inspector attending a DGMS review." />
        </Field>
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-[11.5px] text-blue-800">
          {inspectorMode
            ? 'As an inspector this creates a Reschedule request with status “Pending Approval” — the shared record is not changed until it is approved.'
            : 'As a supervisory role the new date is applied to the shared inspection record immediately.'}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary !py-2 !text-[12px]" onClick={submit}>
            {inspectorMode ? 'Request reschedule' : 'Save new date'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CancelDialog({ entryId, onClose, onError }: {
  entryId: string; onClose: () => void; onError: (msg: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const reasonError = touched && !reason.trim() ? 'A cancellation reason is required.' : undefined;

  function submit() {
    setTouched(true);
    if (!reason.trim()) return;
    try {
      actions.requestCancel(entryId, reason);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not cancel the inspection.');
      onClose();
    }
  }

  return (
    <Modal title={`Cancel inspection · ${entryId}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[12px] text-slate-600">
          The inspection stays in the schedule marked <b>Cancelled</b> with your reason — it is never deleted, so
          the audit trail and KPI history remain intact.
        </p>
        <Field label="Reason" error={reasonError}>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            autoFocus placeholder="e.g. Mine under temporary production halt after rainfall." />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Keep inspection</button>
          <button onClick={submit}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50">
            Cancel inspection
          </button>
        </div>
      </div>
    </Modal>
  );
}
