/**
 * Checklists & Forms (reference page 5).
 *
 * Renders the SAME checklist template definitions the inspection workflow
 * instantiates — selecting a template here and opening an inspection never
 * disagree about sections or items. Every control is live: category/search
 * filtering, template preview, download, jump-to-inspection and clone.
 */
'use client';
import { useMemo, useState } from 'react';
import {
  ClipboardList, Download, Eye, FilePlus2, Layers, Link2, RotateCcw, Search,
} from 'lucide-react';
import { EmptyState, Field, Modal, SectionCard } from '../operations/ui';
import {
  InlineError, NavBtn, PermBtn, SectionCard as Panel, StatusChip,
} from './ui';
import {
  actions, inspectionsUsingTemplate, itemsOf, templateCategories, templatesWithUsage, useMockInspections,
} from '../../lib/inspections/store';
import { downloadTemplate } from '../../lib/inspections/export';

type TemplateWithUsage = ReturnType<typeof templatesWithUsage>[number];

export function ChecklistsLibrary() {
  const db = useMockInspections();
  const [q, setQ] = useState('');
  const [qq, setQq] = useState('');
  const [category, setCategory] = useState('All Checklists');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(() => templateCategories(db), [db]);
  const all = useMemo(() => templatesWithUsage(db), [db]);

  const filtered = useMemo(() => {
    const term = qq.trim().toLowerCase();
    return all.filter((t) => {
      if (category !== 'All Checklists' && t.category !== category) return false;
      if (!term) return true;
      const hay = [t.id, t.name, t.category, t.description, ...t.sectionNames,
        ...itemsOf(db, t.id).map((i) => `${i.requirement} ${i.description}`)].join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [all, category, qq, db]);

  const preview = previewId ? all.find((t) => t.id === previewId) ?? null : null;
  const previewItems = preview ? itemsOf(db, preview.id) : [];
  const totalItems = all.reduce((a, t) => a + t.itemCount, 0);
  const activeFilters = qq !== '' || category !== 'All Checklists';

  function clearFilters() { setQ(''); setQq(''); setCategory('All Checklists'); }

  return (
    <div className="space-y-4">
      {/* Search + categories + primary action */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setQq(q); if (e.key === 'Escape') clearFilters(); }}
            placeholder="Search checklists, sections or items…"
            aria-label="Search checklists"
            className="input !w-80 !pl-9"
          />
        </div>
        <button className="btn-primary !py-2" onClick={() => setQq(q)}>Search</button>
        {activeFilters && (
          <button className="btn-ghost !py-2" onClick={clearFilters}>
            <RotateCcw size={13} className="inline mr-1" /> Clear filters
          </button>
        )}
        <span className="text-[12px] text-slate-500 font-semibold">
          {filtered.length} of {all.length} checklists · {totalItems} items
        </span>
        <div className="ml-auto flex items-center gap-2">
          <PermBtn perm="canEditDetails" onClick={() => setCloneOpen(true)} className="btn-primary !py-2">
            <span className="flex items-center gap-1.5"><FilePlus2 size={14} /> New Checklist</span>
          </PermBtn>
        </div>
      </div>

      <div className="grid xl:grid-cols-4 gap-4">
        {/* Categories */}
        <div className="xl:col-span-1">
          <Panel title="Checklist Categories" subtitle="Grouped the same way as the inspection workflow">
            <ul className="space-y-1.5">
              {[{ name: 'All Checklists', templates: all.length, items: totalItems }, ...categories].map((c) => {
                const active = category === c.name;
                return (
                  <li key={c.name}>
                    <button
                      type="button"
                      onClick={() => setCategory(c.name)}
                      className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition
                        ${active ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200 bg-white hover:border-blue-200'}`}
                    >
                      <Layers size={15} className={active ? 'text-blue-600' : 'text-slate-400'} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-bold text-navy truncate">{c.name}</span>
                        <span className="block text-[11px] text-slate-500">{c.templates} checklist{c.templates === 1 ? '' : 's'}</span>
                      </span>
                      <span className={`badge !text-[10px] ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{c.items}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              Every checklist shown here is the exact definition instantiated by scheduled inspections.
              Demo data — not a statutory form.
            </p>
          </Panel>
        </div>

        {/* Template list */}
        <div className="xl:col-span-3">
          <SectionCard
            title="Checklists & Forms"
            subtitle={`${filtered.length} checklist${filtered.length === 1 ? '' : 's'} · ${filtered.reduce((a, t) => a + t.itemCount, 0)} items`}
            action={activeFilters ? (
              <button className="text-xs font-bold text-blue-600 hover:underline" onClick={clearFilters}>Reset</button>
            ) : undefined}
          >
            {filtered.length === 0 ? (
              <EmptyState
                title="No checklists match your current filters."
                sub="Try adjusting the category or clearing your search."
                action={<button className="btn-primary !py-2" onClick={clearFilters}>Clear filters</button>}
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    onPreview={() => { setError(''); setPreviewId(t.id); }}
                    onDownload={() => { setError(''); downloadTemplate(t, itemsOf(db, t.id)); }}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <InlineError error={error} onDismiss={() => setError('')} />

      {preview && (
        <TemplatePreview
          template={preview}
          items={previewItems}
          onClose={() => setPreviewId(null)}
          onDownload={() => downloadTemplate(preview, previewItems)}
        />
      )}

      {cloneOpen && (
        <CloneTemplateModal
          sources={all}
          onClose={() => setCloneOpen(false)}
          onCreated={(id) => { setCloneOpen(false); setPreviewId(id); setCategory('All Checklists'); }}
          onError={setError}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TemplateRow({ template, onPreview, onDownload }: {
  template: TemplateWithUsage; onPreview: () => void; onDownload: () => void;
}) {
  const db = useMockInspections();
  const first = inspectionsUsingTemplate(db, template.id)[0]?.id ?? null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3 hover:border-blue-300 transition">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <ClipboardList size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-extrabold text-navy">{template.name}</span>
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{template.id}</span>
          <StatusChip v={template.category} dot={false} />
          <span className="text-[11px] text-slate-400">{template.version}</span>
        </div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 line-clamp-1">{template.description}</div>
        <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
          <span>{template.itemCount} items · {template.sectionNames.length} sections</span>
          <span className={template.usageCount ? 'text-blue-700 font-bold' : ''}>
            Used by {template.usageCount} inspection{template.usageCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        {first && (
          <NavBtn href={`/inspector/inspections/${first}`} icon={<Link2 size={13} />}>{first}</NavBtn>
        )}
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-bold text-navy hover:border-blue-300 hover:bg-blue-50/50"
          title="Download a blank DEMO copy of this checklist"
        >
          <Download size={13} /> Download
        </button>
        <PermBtn perm="canWorkChecklist" onClick={onPreview} className="btn-primary !py-1.5 !px-3 !text-[12px]">
          <span className="flex items-center gap-1.5"><Eye size={13} /> Preview</span>
        </PermBtn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TemplatePreview({ template, items, onClose, onDownload }: {
  template: TemplateWithUsage;
  items: ReturnType<typeof itemsOf>;
  onClose: () => void;
  onDownload: () => void;
}) {
  const sections = template.sectionNames
    .map((name) => ({ name, rows: items.filter((i) => i.section === name) }))
    .filter((s) => s.rows.length > 0);
  const mandatory = items.filter((i) => i.mandatory).length;
  const evidence = items.filter((i) => i.evidenceRequired).length;

  return (
    <Modal title={`${template.name} · ${template.id}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <StatusChip v={template.category} dot={false} />
          <span className="badge bg-slate-100 text-slate-600 !text-[10px]">{template.version}</span>
          <span className="text-slate-500">{items.length} items · {sections.length} sections</span>
          <span className="text-slate-500">{mandatory} mandatory</span>
          <span className="text-slate-500">{evidence} evidence-required</span>
        </div>
        <p className="text-[12.5px] text-slate-600">{template.description}</p>

        <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-3">
          {sections.map((s, idx) => (
            <div key={s.name} className="rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t-xl">
                <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-extrabold flex items-center justify-center">{idx + 1}</span>
                <span className="text-[12.5px] font-extrabold text-navy">{s.name}</span>
                <span className="ml-auto text-[11px] text-slate-500">{s.rows.length} items</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {s.rows.map((item) => (
                  <li key={item.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[10.5px] font-mono text-slate-400 mt-0.5 shrink-0">{item.id}</span>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-navy">{item.requirement}</div>
                        <div className="text-[11.5px] text-slate-500">{item.description}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {item.mandatory && <span className="badge bg-amber-100 text-amber-700 !text-[10px]">Mandatory</span>}
                          {item.evidenceRequired && <span className="badge bg-sky-100 text-sky-700 !text-[10px]">Evidence on non-compliance</span>}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">Blank DEMO form — no answers are stored until an inspection starts it.</span>
          <div className="ml-auto flex gap-2">
            <button onClick={onDownload} className="btn-secondary !py-2 !text-[12px]">
              <Download size={13} className="inline mr-1" /> Download blank
            </button>
            <button onClick={onClose} className="btn-primary !py-2 !text-[12px]">Close</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function CloneTemplateModal({ sources, onClose, onCreated, onError }: {
  sources: TemplateWithUsage[];
  onClose: () => void;
  onCreated: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const db = useMockInspections();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(sources[0]?.category ?? 'Safety Inspections');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = touched && !name.trim() ? 'Checklist name is required.' : undefined;
  const source = sources.find((s) => s.id === sourceId);

  function create() {
    setTouched(true);
    if (!name.trim()) return;
    try {
      const id = actions.cloneTemplate(sourceId, { name, category, description });
      onCreated(id);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not create the checklist.');
      onClose();
    }
  }

  return (
    <Modal title="New Checklist" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[12px] text-slate-500">
          Cloning copies every section and item from an existing template so the new checklist is immediately
          usable by a scheduled inspection. Source items: <b>{source?.itemCount ?? 0}</b>.
        </p>
        <Field label="Source checklist">
          <select className="input" value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              const s = sources.find((x) => x.id === e.target.value);
              if (s) setCategory(s.category);
            }}>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id} · {s.itemCount} items)</option>)}
          </select>
        </Field>
        <Field label="Checklist name" error={nameError}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monsoon Preparedness Checklist" autoFocus />
        </Field>
        <Field label="Category">
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)}
            list="insp-checklist-categories" />
          <datalist id="insp-checklist-categories">
            {[...new Set(db.templates.map((t) => t.category))].map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Description" hint="Shown in the template list and preview header.">
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What this checklist covers…" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn-secondary !py-2 !text-[12px]" onClick={onClose}>Cancel</button>
          <button className="btn-primary !py-2 !text-[12px]" onClick={create}>
            <span className="flex items-center gap-1.5"><FilePlus2 size={13} /> Create checklist</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
