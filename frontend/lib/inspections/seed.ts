/**
 * MineNetr Mine Inspector — "My Inspections" centralised synthetic dataset.
 *
 * DETERMINISM
 * -----------
 * Nothing in this module is random at runtime: there is no `Math.random()`,
 * no `Date.now()` and no bare `new Date()` used to derive record *content*.
 * Every id, date, timestamp and pseudo-random choice is a pure function of a
 * stable key (`hashOf` / `pickBy` / `pickIndex` from lib/inspections/format)
 * or an explicit literal written out below, so the dataset — and every KPI,
 * chart and tab count derived from it — is byte-identical on every load until
 * a demo action mutates the store.  All relative dates are computed against
 * the shared demo clock `DEMO_TODAY = '2026-10-03'` (Saturday) with `addDays`.
 *
 * DEMO LABELLING
 * --------------
 * Every entity, coordinate, name, file reference and figure below is
 * FICTIONAL and prepared exclusively for demonstration purposes.  The mine
 * ("Bharat Coal Mine", code BCM-xx), its lat/lng coordinates, the inspectors,
 * the DGMS-style emails (`@dgms-demo.gov.in`) and every document/evidence
 * reference (`DEMO-FILE://…`) are synthetic — nothing here implies a live DGMS
 * submission, a real regulatory filing or a real mine location.
 *
 * The snapshot returned by `inspectionSnapshot()` is built from scratch on
 * every call — no array or object is shared between calls — so the store can
 * hand it out (or mutate it) safely.
 *
 * Dataset shape (counts are asserted by the module's verification pass):
 *   8 sites · 6 inspectors · 10 templates · 150 checklist items ·
 *   36 inspections (15 Completed / 3 In Progress / 2 Pending Submission /
 *   14 base-Upcoming of which 4 derive to Overdue / 2 Cancelled) ·
 *   ~420 responses · 25 evidence records · 20 findings · 15 reports ·
 *   16 notes · 120 documents · 6 requests · 64 activity entries.
 */
import {
  DEMO_TODAY,
  DOCUMENT_CATEGORIES,
  INSPECTION_TYPES,
  WEATHER_OPTIONS,
  type ChecklistItemDef,
  type ChecklistResponse,
  type ChecklistResponseValue,
  type ChecklistTemplate,
  type DocumentCategory,
  type Evidence,
  type EvidenceType,
  type FindingStatusValue,
  type Inspection,
  type InspectionActivity,
  type InspectionDocument,
  type InspectionFinding,
  type InspectionNote,
  type InspectionReport,
  type InspectionSeedSnapshot,
  type InspectionStatus,
  type Inspector,
  type MineSite,
  type Priority,
  type ReportStatusValue,
  type RequestKind,
  type RequestStatusValue,
  type RescheduleRequest,
  type SafetyCondition,
  type SiteDetails,
} from './types';
import { FindingCategory, FindingSource, Severity } from '../dgms/types';
import { addDays, fmtDate, hashOf, pickBy, pickIndex } from './format';

// ---------------------------------------------------------------------------
// Small local helpers (all deterministic)
// ---------------------------------------------------------------------------

const pad = (n: number, w = 3): string => String(n).padStart(w, '0');

/** Stable 0..1 value for a key — replaces Math.random() for content choices. */
const unit = (key: string): number => (hashOf(key) % 100000) / 100000;

/** '09:00' + 90 → '10:30' (signed, wraps inside the same day). */
function plusMins(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** ISO timestamp (IST) for a calendar date + HH:MM — never the machine clock. */
const at = (date: string, hhmm: string): string => `${date}T${hhmm}:00+05:30`;

/** Evenly spread `n` samples from a list (deterministic, order preserving). */
function evenSample<T>(arr: readonly T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  const out: T[] = [];
  for (let k = 0; k < n; k++) out.push(arr[Math.floor((k * arr.length) / n)]);
  return out;
}

const tpl = (text: string, vars: Record<string, string>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');

// ---------------------------------------------------------------------------
// 1. Mine sites (8) — fictional demonstration coordinates only
// ---------------------------------------------------------------------------

interface SiteDef {
  id: string; code: string; name: string; area: string;
  state: string; district: string; siteType: MineSite['siteType'];
  lat: number; lng: number; zones: string[];
}

const SITE_DEFS: readonly SiteDef[] = [
  {
    id: 'SITE-01', code: 'BCM-01', name: 'Bharat Coal Mine', area: 'Main Mining Area',
    state: 'Chhattisgarh', district: 'Korba', siteType: 'Opencast Coal Mine',
    lat: 22.1734, lng: 82.6418,
    zones: ['East Pit – Level 2', 'Haul Road H2', 'OB Dump Tier 3', 'Magazine Yard', 'Blasting Shelter', 'Safety Cabin'],
  },
  {
    id: 'SITE-02', code: 'BCM-02', name: 'Bharat Coal Mine', area: 'West Block',
    state: 'Chhattisgarh', district: 'Korba', siteType: 'Opencast Coal Mine',
    lat: 22.2069, lng: 82.5873,
    zones: ['West Pit – Level 1', 'Dip Side Working', 'Pit Bottom Sump', 'Haul Road H4', 'First Aid Room'],
  },
  {
    id: 'SITE-03', code: 'BCM-03', name: 'Bharat Coal Mine', area: 'East Pit',
    state: 'Jharkhand', district: 'Dhanbad', siteType: 'Opencast Coal Mine',
    lat: 22.3417, lng: 82.7105,
    zones: ['East Pit – Level 2', 'Panel 4 Inbye', 'Haul Road H1', 'Bench 6 Crest', 'Magazine Yard'],
  },
  {
    id: 'SITE-04', code: 'BCM-04', name: 'East Pit – Level 2', area: 'Pit Benches & Haul Roads',
    state: 'Jharkhand', district: 'Dhanbad', siteType: 'Opencast Coal Mine',
    lat: 22.3058, lng: 82.7642,
    zones: ['Bench 12 Crest', 'Haul Road H3', 'Blasting Shelter', 'OB Dump Tier 3', 'Crusher Bay 3'],
  },
  {
    id: 'SITE-05', code: 'BCM-05', name: 'West Pit – Level 1', area: 'Dip Side Working',
    state: 'Jharkhand', district: 'Bokaro', siteType: 'Opencast Coal Mine',
    lat: 22.1186, lng: 82.4891,
    zones: ['Dip Side Working', 'Pit Bottom Sump', 'West Pit – Level 1', 'Slope Batter A', 'Safety Cabin'],
  },
  {
    id: 'SITE-06', code: 'BCM-06', name: 'Central Workshop', area: 'Repair Bays & Stores',
    state: 'Jharkhand', district: 'Dhanbad', siteType: 'Workshop',
    lat: 22.2745, lng: 82.6934,
    zones: ['Workshop Bay 2', 'Magazine Yard', 'DG Set Yard', 'Stores & Spares Bay', 'First Aid Room'],
  },
  {
    id: 'SITE-07', code: 'BCM-07', name: 'Conveyor Belt Section', area: 'Overland Conveyor NL-2',
    state: 'Jharkhand', district: 'Dhanbad', siteType: 'Conveyor Corridor',
    lat: 22.3312, lng: 82.6287,
    zones: ['Conveyor Gallery 2', 'Discharge Point D2', 'Lightning Arrestor Panel', 'Transfer Point T4', 'Safety Cabin'],
  },
  {
    id: 'SITE-08', code: 'BCM-08', name: 'Crushing & Dispatch Zone', area: 'GCD Plant & Dispatch',
    state: 'Chhattisgarh', district: 'Korba', siteType: 'Crushing & Dispatch',
    lat: 22.1497, lng: 82.5526,
    zones: ['GCD Stockpile', 'Crusher Bay 3', 'Discharge Point D2', 'Truck Loading Bay', 'Weighbridge Cabin'],
  },
];

// ---------------------------------------------------------------------------
// 2. Inspectors (6) — INSP-06 (Amit Verma) is the signed-in demo user
// ---------------------------------------------------------------------------

const INSPECTOR_DEFS: readonly Inspector[] = [
  { id: 'INSP-01', name: 'R. K. Sharma', designation: 'Senior Labour Officer (SLO)', state: 'Jharkhand', email: 'r.k.sharma@dgms-demo.gov.in' },
  { id: 'INSP-02', name: 'A. Singh', designation: 'Mine Safety Officer', state: 'Chhattisgarh', email: 'a.singh@dgms-demo.gov.in' },
  { id: 'INSP-03', name: 'P. N. Verma', designation: 'Electrical Inspector', state: 'Odisha', email: 'p.n.verma@dgms-demo.gov.in' },
  { id: 'INSP-04', name: 'S. Tiwari', designation: 'Mechanical Inspector', state: 'Madhya Pradesh', email: 's.tiwari@dgms-demo.gov.in' },
  { id: 'INSP-05', name: 'K. Das', designation: 'Environmental Officer', state: 'Jharkhand', email: 'k.das@dgms-demo.gov.in' },
  { id: 'INSP-06', name: 'Amit Verma', designation: 'Mine Inspector (DGMS)', state: 'Jharkhand', email: 'amit.verma@dgms-demo.gov.in' },
];

/** The performer of every seeded inspection. */
const CURRENT_USER = 'INSP-06';
/** Supervisors who assign work — cycles INSP-01 … INSP-05. */
const ASSIGNERS: readonly string[] = ['INSP-01', 'INSP-02', 'INSP-03', 'INSP-04', 'INSP-05'];

// ---------------------------------------------------------------------------
// 3. Checklist templates + items (10 templates / exactly 150 items)
// ---------------------------------------------------------------------------

interface ItemSpec { readonly r: string; readonly d: string; readonly m: boolean; readonly e: boolean }

/** Compact literal for one checklist line: requirement, description, mandatory, evidence. */
const it = (r: string, d: string, m = true, e = false): ItemSpec => ({ r, d, m, e });

interface SectionPlan { readonly name: string; readonly items: readonly ItemSpec[] }
interface TemplatePlan {
  readonly id: string; readonly name: string; readonly category: string;
  readonly description: string; readonly version: string; readonly sections: readonly SectionPlan[];
}

const TEMPLATE_PLANS: readonly TemplatePlan[] = [
  // -------------------------------------------------------------------------
  // TMPL-01 — Routine Safety Inspection Checklist (56 items, 8 sections)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-01',
    name: 'Routine Safety Inspection Checklist',
    category: 'Safety Inspections',
    description: 'End-to-end statutory safety round covering every operational area of an opencast coal mine — the default checklist for scheduled DGMS-style visits.',
    version: 'v3.1',
    sections: [
      {
        name: 'General Information',
        items: [
          it('Inspection entry recorded at the mine gate and the shift in-charge informed of the visit',
            'Confirms the gate register carries the visit entry and the shift in-charge acknowledged the arrival before work began.'),
          it('Current approved mine plan and working-section diagram available at the control room',
            'Checks the latest sanctioned plan is on display so every inspected section can be verified against the approved workings.'),
          it('Statutory registers — attendance, visit and overman’s rolls — produced at the inspection location',
            'Verifies the registers required under the Mines Act rules are physically available and up to date on site.'),
          it('Shift handover record for the visited section countersigned by the outgoing and incoming overman',
            'Confirms continuity of supervision by reviewing the handover entries for the section under inspection.'),
          it('Ambient weather, visibility and haul-road surface conditions recorded at the time of arrival',
            'Documents the baseline ground conditions so later observations on dust, drainage or visibility can be judged in context.'),
          it('Contact numbers of the mine manager, overman and rescue station displayed at the safety cabin',
            'Checks the emergency contact board at the safety cabin is current and legible for shift personnel.', false),
        ],
      },
      {
        name: 'Mine Safety',
        items: [
          it('PPE compliance in active zones — helmet, reflective jacket and safety shoes worn by all persons in the pit',
            'Walks the active working areas and checks each person against the mandatory personal protective equipment requirement.', true, true),
          it('Haul-road edge berms of adequate height maintained along the full stretch with kilometre and warning signage',
            'Measures sample berm heights and looks for missing reflector posts or kilometre boards along the inspected stretch.', true, true),
          it('Bench faces and batter angles free of loose overhangs above active working levels',
            'Visually inspects each bench face for loose material or unsafe batter angles that could endanger persons working below.', true, true),
          it('Warning siren and dumper approach signals audible across the working pit',
            'Confirms the apex siren and vehicle approach alarms can be heard at all manned locations inside the pit.'),
          it('First-aid room stocked, stretcher trolley available and register in current use',
            'Checks the first-aid room, its drug stock and the stretcher arrangement kept ready for evacuation casualties.', true, true),
          it('Fire extinguishers charged and in date at HEMM parking, DG set and stores',
            'Verifies every extinguisher is sealed, within its test date and positioned at the required points.'),
          it('Safe access route, ladders and handrails to the pit bottom sump maintained',
            'Examines the sump approach steps and handrails for safe movement during dewatering operations.'),
          it('Traffic segregation between dumper convoys and light vehicles at the dispatch tipper',
            'Checks that light-vehicle movement is physically separated from dumper routes at the dispatch tipping point.'),
        ],
      },
      {
        name: 'Environmental Compliance',
        items: [
          it('Dust suppression — water sprays and road watering operating on all in-use haul roads',
            'Confirms sprays are running and the road-watering frequency is recorded for the inspected haul roads.', true, true),
          it('Ambient particulate monitoring at the boundary and nearest habitation within prescribed limits',
            'Reviews the latest PM10 and PM2.5 readings from the monitoring stations against the clearance limits.'),
          it('Workshop effluent drained to the soak pit with no oily discharge reaching the nallah',
            'Traces the drainage path from the repair bays to the soak pit and looks for oil or sludge escaping into the natural drain.', true, true),
          it('Dewatering discharge routed away from the working pit through lined channels',
            'Checks the sump discharge channel is directed to the designated outlet and has not eroded the working area.'),
          it('Topsoil stripping, stacking and reclamation progress on the completed OB dump tiers',
            'Compares reclamation progress on the reclaimed dump tiers with the sanctioned environmental management plan.', false),
          it('Noise levels at the boundary during blasting and crusher operations within the prescribed envelope',
            'Reviews periodic noise survey values and listens for avoidable continuous sources near the property line.', false),
          it('Environmental clearance conditions and mitigation commitments displayed for workers',
            'Confirms the site office displays the clearance conditions so supervisory staff can follow them.'),
        ],
      },
      {
        name: 'Mechanical & Electrical',
        items: [
          it('Fixed guards bolted on crusher, screen and conveyor drive components with interlocks functional',
            'Physically tugs each guard and operates the interlocks to confirm the machine cannot run with a guard open.', true, true),
          it('Pre-shift inspection logbook signed for every dumper, shovel and dozer on duty',
            'Samples operator logbooks to confirm each machine was inspected and cleared before the shift began.'),
          it('DG set earthing, fuel bunding and exhaust routing compliant at the standby power yard',
            'Checks the standby set’s earthing connection, spill containment and exhaust direction away from occupied areas.', true, true),
          it('Wire rope, hook and brake condition of the shovel and crane inspected and recorded',
            'Reviews shift inspection entries for hoisting appliances and looks for visible rope damage or brake lag.'),
          it('Travel alarm, reverse horn and beacon working on all dumpers and dozers',
            'Each machine is sounded in reverse to verify the alarm and beacon warn personnel adequately.'),
          it('Electrical panels closed, labelled with feeder names and lockable',
            'Walks the panel room to confirm no door is left open and every outgoing feeder carries a legible label.'),
          it('Safe ladders, walkways and handrails to the conveyor gallery and transfer points',
            'Checks access structures to elevated conveyor sections for damage, corrosion or missing handrails.'),
          it('Safety valve and pressure gauge validity on air and compressor receivers',
            'Notes the certification dates of pressure vessels to flag any test certificate expiring soon.', false),
        ],
      },
      {
        name: 'Production & Dispatch',
        items: [
          it('Weighbridge calibration certificate current and slip printing legible for dispatch records',
            'Verifies the calibration tag and prints a trial slip to confirm weighment accuracy for coal dispatch.'),
          it('GCD stockpile and dispatch yard housekeeping — no spillage along loading lines',
            'Inspects the stockpile apron and tipper lines for spilled coal and blocked access routes.'),
          it('Dump height, batter and crest position of the OB dump within the sanctioned geometry',
            'Measures the dump height against the approved stacking plan to prevent over-height tipping.', true, true),
          it('Daily production and dispatch figures reconciled with the surveyor’s rounding plan',
            'Compares the shift production register with surveyor records to confirm reporting integrity.', false),
          it('Crusher and conveyor spillage cleared and idlers free of material build-up',
            'Checks under the crusher and along the belt for spillage that could foul the belt.', false),
          it('Gate pass and lorry dispatch register entries complete for outgoing coal loads',
            'Reviews the gate register against dispatch slips to confirm every outbound load is accounted for.'),
          it('Flood-light and task lighting adequate at the dispatch bay for evening operations',
            'Confirms lighting levels at the tipper and weighbridge areas support safe night working.'),
        ],
      },
      {
        name: 'Workers & Contractor',
        items: [
          it('Gate-pass biometric and visual verification completed for every contractor worker on duty',
            'Samples crew at the working face against the gate register to confirm only inducted persons are deployed.'),
          it('Contractor licences and statutory displays available at the site office',
            'Checks the contract labour licence, PF and ESIC registrations are current and produced on demand.'),
          it('Muster roll and contractor attendance register maintained and countersigned daily',
            'Confirms daily muster entries are complete and signed by the authorised supervisor.'),
          it('Induction and refresher training certificates current for workers deployed in the last six months',
            'Samples training records of recently deployed workers against the statutory induction requirement.'),
          it('Drinking water, toilets and rest shelters provided at the working locations',
            'Checks welfare amenities are present, clean and reachable within a reasonable distance of the workface.'),
          it('Work permits issued for hot work, confined space and height jobs currently in progress',
            'Verifies each live high-risk job carries a valid permit signed by the competent authority.'),
          it('Supervisor-to-worker ratio for the visited contract within the sanctioned deployment plan',
            'Compares the supervisors present with the crew strength to confirm adequate supervision.', false),
          it('Toolbox talk conducted for the shift with the record signed by attendees',
            'Reviews the day’s toolbox talk record covering the specific hazards of the visited section.', true, true),
        ],
      },
      {
        name: 'Emergency Preparedness',
        items: [
          it('Evacuation routes marked from every working section with a clearly identified assembly point',
            'Walks the designated escape routes and checks signage leads to the muster point without ambiguity.', true, true),
          it('Emergency contact board updated with the mine manager, DGMS office and nearest hospital',
            'Confirms the displayed emergency numbers are current and readable at the safety cabin.'),
          it('Rescue equipment, oxygen breathing apparatus and resuscitator trolley serviceable',
            'Checks rescue gear is sealed, within test date and positioned for immediate deployment.'),
          it('Ambulance with trained paramedic available at the mine office within the response time',
            'Confirms the ambulance is fuelled, stocked and staffed for immediate evacuation.'),
          it('Emergency lighting and battery lamps available in the conveyor gallery and sump',
            'Checks battery-backed lighting exists for dark-area rescue movement.', false),
          it('Mock drill conducted within the last quarter with a recorded post-drill review',
            'Reviews the drill record, participation and the corrective actions arising from the review.'),
        ],
      },
      {
        name: 'Closing Remarks',
        items: [
          it('Overall site safety condition rating recorded against the visit',
            'Captures the inspector’s overall rating so trend analysis across visits remains possible.'),
          it('All non-compliances discussed with the mine management before closing the visit',
            'Confirms findings were explained on site and management had the chance to respond.'),
          it('Corrective-action timeline agreed for every flagged deficiency',
            'Records the dates committed by the mine for each non-compliance raised during the inspection.'),
          it('Inspector’s closing remarks entered in the statutory visit register',
            'Checks the visit register carries the inspector’s concluding remarks and signature.', false),
          it('Photographs and supporting evidence attached to every flagged checklist item',
            'Verifies each non-compliant line carries at least one supporting photograph or note.', false),
          it('Mine management acknowledgement of the findings obtained on the day of inspection',
            'Confirms the manager’s representative countersigned the findings before departure.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-02 — Environmental Compliance Checklist (11 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-02',
    name: 'Environmental Compliance Checklist',
    category: 'Environmental',
    description: 'Focused environmental round covering dust, noise, water and effluent obligations carried from the environmental clearance conditions.',
    version: 'v2.4',
    sections: [
      {
        name: 'Air & Dust',
        items: [
          it('Ambient PM10 and PM2.5 readings at the boundary station within the clearance limits',
            'Reviews the latest monitoring outputs from the boundary station against the sanctioned limits.'),
          it('Water-spray and dust suppression on haul roads operational during the visit',
            'Confirms the sprays are running end-to-end and the watering log matches the shift actually worked.', true, true),
          it('Covered transport and transfer-point suppression at the crusher and conveyor chutes',
            'Checks transfer points are covered or fogged so coal does not plume into the ambient air.', true, true),
          it('Wind-break screens installed and intact along the stockpile periphery',
            'Inspects the screens for tears and verifies they are positioned on the windward side of the stockpile.'),
          it('Fog cannon / mist fan placement serving the GCD stockpile in working order',
            'Confirms the dust-control fans are placed to cover the stockpile face and run without interruption.', false),
          it('Road watering frequency recorded daily for the in-use haul roads',
            'Cross-checks the watering register against the shift diary to confirm compliance with the schedule.'),
        ],
      },
      {
        name: 'Water & Effluent',
        items: [
          it('Workshop effluent settling into the soak pit with no discharge into the natural drain',
            'Follows the workshop channel to the soak pit and looks for oily traces escaping into the nallah.', true, true),
          it('Effluent quality test report (pH, TSS, oil & grease) within prescribed limits',
            'Reviews the latest laboratory report of the settled effluent against the consent conditions.'),
          it('Dewatering discharge routed away from the working pit through the designated outlet',
            'Confirms the sump water leaves the working area through the approved channel without scouring benches.'),
          it('Oil interceptor in service at the repair bays and cleaned on schedule',
            'Checks the interceptor at the bays is installed, flowing and within its cleaning cycle.', true, true),
          it('Rainwater drainage channels free of overburden blockage ahead of the wet season',
            'Walks the diversion channels to confirm they are desilted and free of overburden spillage.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-03 — Machine Safety & Maintenance Checklist (10 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-03',
    name: 'Machine Safety & Maintenance Checklist',
    category: 'Machinery & Electrical',
    description: 'Machine-guarding and maintenance-record verification for crushers, conveyors and mobile HEMM operating in the mine.',
    version: 'v1.8',
    sections: [
      {
        name: 'Guards & Interlocks',
        items: [
          it('Crusher flywheel and conveyor pulley guards bolted in place without gaps',
            'Checks each guard is firmly fastened and offers no opening that could admit a limb or clothing.', true, true),
          it('Emergency pull-cord switches along the conveyor belt tested and responsive',
            'Operates sample pull-cord switches and confirms the belt trips immediately at the local panel.', true, true),
          it('Interlocked access gates on the screen and tipple prevent startup when open',
            'Opens a sample gate with the drive stopped and confirms the starter circuit is genuinely broken.', true, true),
          it('Rotating parts of pumps, compressors and couplings fully enclosed',
            'Inspects auxiliary machines for exposed couplings, set screws or rotating shafts.'),
          it('Guard fasteners tamper-proof and warning labels legible on all moving parts',
            'Looks for missing fasteners and faded danger labels across the machine house.', false),
        ],
      },
      {
        name: 'Maintenance Records',
        items: [
          it('Pre-shift inspection logbook signed by the operator before the machine was put to duty',
            'Samples operator logbooks for signatures and confirms entries predate the shift start.'),
          it('Preventive maintenance schedule up to date for the HEMM fleet on duty',
            'Compares the PM chart with actual servicing dates to identify overdue machines.'),
          it('Oil-change and filter records maintained for the dumper fleet',
            'Reviews lubrication records for consistency with the machine hours shown on hour meters.'),
          it('Breakdown register carries clearance-to-operate entries after every repair',
            'Confirms each repaired machine was formally released for duty by the competent authority.'),
          it('Lubrication chart displayed at the workshop bay with grade and frequency details',
            'Checks the chart at the bay matches the lubricants actually in use.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-04 — Worker Documentation Verification (9 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-04',
    name: 'Worker Documentation Verification',
    category: 'Worker & Contractor',
    description: 'Personnel-record verification for directly deployed and contract workers, sampled at the workface and the site office.',
    version: 'v2.0',
    sections: [
      {
        name: 'Document Verification',
        items: [
          it('Identity proof of every sampled worker verified with a masked copy retained',
            'Matches sampled workers against their identity records and confirms only masked copies are held on site.'),
          it('Medical fitness certificates current for operators above the prescribed age',
            'Checks fitness validity for the sampled operators and flags certificates nearing expiry.'),
          it('Mine safety induction certificates issued within the last six months for new joiners',
            'Verifies recent joiners completed statutory induction before being deployed to the pit.'),
          it('Valid trade test certificates for electricians, fitters and welders on site',
            'Confirms skilled workers hold trade tests relevant to the work they were observed performing.'),
          it('EPFO and ESIC registration records available for the contract crew',
            'Reviews the statutory social-security registrations produced for the deployed contract workers.'),
          it('Contract labour licence under the Contract Labour Act displayed and within validity',
            'Checks the licence covers the current contract period and is available at the site office.'),
          it('Gate-pass biometric enrolment completed for every crew member on duty',
            'Confirms each sampled worker appears in the biometric gate log for the current date.'),
          it('Specialty certifications (explosive handling, working at heights) held by tagged workers',
            'Verifies the workers observed on tagged jobs carry the specialty certification required for them.', true, true),
          it('Nominee and emergency contact forms collected for the deployed crew',
            'Confirms emergency contact and nomination forms are collected and filed for every sampled worker.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-05 — Emergency Preparedness & Evacuation (12 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-05',
    name: 'Emergency Preparedness & Evacuation',
    category: 'Emergency & Evacuation',
    description: 'Readiness round for evacuation routes, rescue equipment, communication and drill compliance across the working areas.',
    version: 'v2.2',
    sections: [
      {
        name: 'Evacuation readiness',
        items: [
          it('Marked evacuation routes from every working section leading to the surface',
            'Walks the escape routes end-to-end and confirms way-bands and direction arrows are unbroken.', true, true),
          it('Assembly point signage and muster board updated for the current crew strength',
            'Checks the muster board lists the present shift strength and the assembly point signage is visible.', true, true),
          it('Escape self-rescuers and breathing apparatus within test date and sealed',
            'Samples rescue canisters for seal condition and the date of the last statutory test.'),
          it('Road-vehicle evacuation plan covering the pit exit and ramp bottlenecks',
            'Reviews the vehicle evacuation plan against the actual ramp configuration used by dumper convoys.'),
          it('Emergency exit lighting operative in the conveyor gallery and crusher house',
            'Confirms battery-backed exit lighting illuminates the stairways when main supply is isolated.', true, true),
          it('Talk-back communication to all sections tested during the visit',
            'Operates the section call points and confirms clear acknowledgement from each manned location.'),
        ],
      },
      {
        name: 'Drills & Communication',
        items: [
          it('Mock drill conducted within the last quarter with a recorded post-drill review',
            'Reviews the drill report, participation sheet and the actions closed from the review.'),
          it('Emergency siren audibility confirmed across all working areas of the mine',
            'Listens for the apex siren at the farthest manned point of each inspected working area.'),
          it('Rescue team roster with availability of trained members on the current shift',
            'Confirms the roster names trained rescue members actually present during the visit.'),
          it('Emergency contact list (mine manager, DGMS, hospital, fire service) current on display',
            'Checks the displayed contact list against recent deputations and hospital changes.'),
          it('First-aid trained persons present on every shift at the working locations',
            'Samples the muster roll for at least one current first-aid certificate holder per shift.'),
          it('Lessons from the last drill incorporated into the emergency plan revision',
            'Compares the emergency plan revision with the observations recorded in the latest drill report.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-06 — Contractor Compliance Audit (11 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-06',
    name: 'Contractor Compliance Audit',
    category: 'Worker & Contractor',
    description: 'Statutory and site-level compliance audit of contractors deployed for overburden, haulage and services inside the mine.',
    version: 'v1.5',
    sections: [
      {
        name: 'Statutory registers',
        items: [
          it('Muster roll maintained daily and countersigned by the overman',
            'Checks the muster roll carries daily signatures of the mine’s authorised supervisor.'),
          it('Wage register and overtime entries available for the contract crew',
            'Reviews wage and overtime records for the current contract period against the muster roll.'),
          it('Leave-with-wages records maintained for the contract period',
            'Confirms statutory leave entitlements are recorded and availed as per the licence conditions.'),
          it('Accident and near-miss register updated with the latest entry dated',
            'Checks the register is current and that recent near-misses carry follow-up remarks.'),
          it('Gate pass and material issue register reconciled for the contractor’s tools and plant',
            'Reconciles sample tool and plant movements against the gate pass book for the current month.'),
          it('Statutory notices (minimum wages, PF, ESIC) displayed at the contractor site office',
            'Confirms the prescribed notices are displayed, legible and current.', false),
        ],
      },
      {
        name: 'Site compliance',
        items: [
          it('Contractor safety officer present with a valid certificate for the deployed strength',
            'Verifies the safety officer’s certificate is current and the officer is present on the worksite.'),
          it('Work-at-heights and confined-space permits issued for jobs in progress',
            'Checks live high-risk jobs carry valid permits with the prescribed gas-test entries.', true, true),
          it('Scaffolding, ladders and staging inspected and tagged before use',
            'Confirms every ladder and scaffold bay carries a dated inspection tag by a competent person.', true, true),
          it('Contractor work area housekeeping — no trailing cables, spillage or loose debris',
            'Walks the work area to confirm cables, hoses and debris are managed to avoid trip and fire hazards.'),
          it('Contract validity period covers the work currently being executed',
            'Compares the contract term and licence validity with the scope of work observed on site.'),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-07 — Electrical Installation Safety (10 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-07',
    name: 'Electrical Installation Safety',
    category: 'Machinery & Electrical',
    description: 'Earthing, isolation and protection-device verification for the mine’s fixed electrical installations and distribution panels.',
    version: 'v3.0',
    sections: [
      {
        name: 'Earthing & Isolation',
        items: [
          it('Earthing pits free of corrosion with continuity test records current',
            'Opens sample pits, inspects electrodes and checks the continuity test sheet for validity.', true, true),
          it('MCC and panel earthing busbar bonded with numbered earth connections',
            'Confirms every outgoing feeder earth is bonded to the busbar and numbered to the schedule.', true, true),
          it('Isolation points labelled and lock-out / tag-out kits available at the panel room',
            'Checks isolation points carry danger tags and that LOTO kits with personal locks are issued.'),
          it('DG neutral earthing switch in the position prescribed for the running configuration',
            'Verifies the neutral earthing arrangement matches the operating mode of the standby set.'),
          it('Portable equipment earthed only through a proper three-pin connection',
            'Inspects portable tools and welding sets for earth continuity through the plug or dedicated earth.'),
        ],
      },
      {
        name: 'Protection devices',
        items: [
          it('RCCB and MCB protection trip-tested on outgoing circuits',
            'Operates the test buttons on sample circuits and confirms the device trips within the expected time.', true, true),
          it('Overload and single-phasing protection functional on pump and compressor motors',
            'Reviews relay settings and trip records for the motors serving the pit drainage and air supply.'),
          it('Lightning arrestor and surge protection installed at the incoming panel',
            'Checks surge protectors are installed, in date and their status indicators are healthy.'),
          it('Outdoor panel enclosure integrity (IP rating) undamaged by weather or impact',
            'Looks for damaged gaskets, corroded doors and water ingress marks on outdoor enclosures.', true, true),
          it('Cable routing free of joints in trenches, drums and gate wiring runs',
            'Walks the cable routes to confirm joints are absent from trenches and gate wiring is properly supported.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-08 — Explosive Handling & Dispatch (9 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-08',
    name: 'Explosive Handling & Dispatch',
    category: 'Safety Inspections',
    description: 'Magazine, shot-firing and explosives-dispatch verification covering custody, exclusion zones and misfire readiness.',
    version: 'v2.7',
    sections: [
      {
        name: 'Magazine & Shot-firing',
        items: [
          it('Magazine stores-in-charge holds a valid licence and is present during issue',
            'Confirms the licensed custodian personally conducted the explosive issue and receipt entries.'),
          it('Explosive and detonator stores physically separated by the prescribed safe distance',
            'Measures the separation between the explosive and detonator compartments and checks both locks.'),
          it('Magazine register entries tallied with the day’s issue and return of explosives',
            'Reconciles opening stock, issue, return and closing balance in the magazine register for the day.'),
          it('Magazine earthing and shot-firing line continuity tested with records available',
            'Checks the earthing pits at the magazine and reviews the shot-firing line continuity test sheet.', true, true),
          it('Misfire procedure board and danger-signalling apparatus kept at the firing point',
            'Verifies the misfire board, red flag and detonator exploder are present and serviceable.'),
          it('Shot-firing exclusion zone signed, guarded and cleared before every firing',
            'Confirms danger boards, sentry placement and personnel clearance were completed before firing.', true, true),
          it('Authorised shot-firers list current and only authorised persons observed firing',
            'Compares the firing party against the current authorised shot-firer list maintained by the mine.'),
          it('Explosives van parked in the designated area with fire extinguisher on board',
            'Inspects the parked vehicle, its extinguisher and the escort arrangement for the explosive payload.', false),
          it('Empty cartridge and misfire disposal route documented and followed',
            'Reviews the documented disposal route for empty cartridges and misfire remnants from the last blast.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-09 — Structural Safety & Dump Stability (11 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-09',
    name: 'Structural Safety & Dump Stability',
    category: 'Safety Inspections',
    description: 'Geotechnical and structural round covering bench geometry, dump stability and the integrity of fixed plant structures.',
    version: 'v1.9',
    sections: [
      {
        name: 'Benches & Slopes',
        items: [
          it('Bench heights and batter slopes conform to the approved mine plan geometry',
            'Measures sample bench heights and batter angles against the sanctioned working geometry.', true, true),
          it('Dump and bench crests free of cracks indicating progressive slope movement',
            'Walks the crest line looking for tension cracks, setback or seepage that hint at instability.', true, true),
          it('Safe berm height maintained along the dump toe and approach road edge',
            'Checks toe berms are continuous and high enough to stop a dumper running off the edge.'),
          it('Rain-cut and erosion gullies on the dump face within repairable limits',
            'Inspects the dump face for developing gullies that could undermine the tipping bench.', true, true),
          it('Haul road cut slopes stable after the recent monsoon rainfall',
            'Reviews cut slopes along in-use haul roads for sloughing, raveling or saturated bands.'),
          it('Warning signage present at the crest of every active dump',
            'Confirms danger boards and no-tipping markers are placed at all active dump crests.', false),
        ],
      },
      {
        name: 'Structures',
        items: [
          it('Crusher and conveyor gantry structural members free of corrosion or deformation',
            'Inspects columns, bracings and connections of the gantry for corrosion, buckling or cracked welds.', true, true),
          it('Workshop roof trusses and columns free of deformation or ponding damage',
            'Checks the workshop structure for sagging trusses, corroded purlins and water ponding marks.'),
          it('Conveyor trestle support legs free of scour, settlement or lean',
            'Examines each trestle footing for scour at the base and any visible settlement or tilt.', true, true),
          it('Stockpile retaining wall plumb with no bulging or foundation scour',
            'Verifies the wall line is true, unstained by seepage and free of toe scour.'),
          it('Water tank and tower platform railings intact and galvanised',
            'Checks elevated platforms for corroded railings, missing kick-plates and safe access ladders.', false),
        ],
      },
    ],
  },
  // -------------------------------------------------------------------------
  // TMPL-10 — Statutory Compliance & Records (11 items)
  // -------------------------------------------------------------------------
  {
    id: 'TMPL-10',
    name: 'Statutory Compliance & Records',
    category: 'Statutory Records',
    description: 'Documentary compliance round for statutory postings, registers, licences and closure of earlier warning orders.',
    version: 'v2.1',
    sections: [
      {
        name: 'Statutory postings',
        items: [
          it('Mining plan and approved working layout displayed at the site office',
            'Confirms the sanctioned plan is displayed with the current working sections marked on it.'),
          it('Emergency contact and statutory authority notices displayed and legible',
            'Checks notices for the mine manager, DGMS office and emergency services are current on the board.'),
          it('Dust-limit and noise-limit notices displayed at the property boundary',
            'Verifies the environmental limit notices are posted where the public approach is possible.', false),
          it('Daily inspection chart signed by the Manager or their authorised delegate',
            'Reviews the chart for daily signatures covering the inspected period.'),
          it('Overman’s plan and section-wise safety instructions posted at the working locations',
            'Confirms the overman’s plan and safety instructions are available where the crew works.'),
          it('Environmental clearance conditions summary displayed for supervisory staff',
            'Checks the clearance summary is displayed so supervisors can implement the conditions on the ground.'),
        ],
      },
      {
        name: 'Registers & licences',
        items: [
          it('Register of visits carrying the latest entries by DGMS and internal inspectors',
            'Reviews recent visit entries to confirm the register is current and properly signed.'),
          it('Statutory test certificates (electrical, air, lifting) current for the plant in use',
            'Checks validity dates of the statutory test reports for the equipment sampled on the day.', true, true),
          it('Boiler and pressure vessel certificates within validity on the premises',
            'Confirms certificates are available, in date and match the equipment identification plates.'),
          it('Environmental management plan annual monitoring report available on site',
            'Reviews the latest annual monitoring report against the commitments made in the clearance.', true, true),
          it('Previous warning orders and inspection observations closed with evidence',
            'Checks each earlier observation carries closure evidence accepted by the reviewing officer.'),
        ],
      },
    ],
  },
];

/**
 * Materialises templates + the module-wide CHK-001…CHK-150 item catalogue.
 * Runs inside `inspectionSnapshot()` so every call returns fresh objects.
 */
function buildTemplates(): { templates: ChecklistTemplate[]; items: ChecklistItemDef[] } {
  const templates: ChecklistTemplate[] = [];
  const items: ChecklistItemDef[] = [];
  let seq = 0;
  for (const plan of TEMPLATE_PLANS) {
    const sectionNames: string[] = [];
    let count = 0;
    for (const section of plan.sections) {
      sectionNames.push(section.name);
      for (const spec of section.items) {
        seq += 1;
        items.push({
          id: `CHK-${pad(seq)}`,
          templateId: plan.id,
          section: section.name,
          requirement: spec.r,
          description: spec.d,
          mandatory: spec.m,
          evidenceRequired: spec.e,
        });
        count += 1;
      }
    }
    templates.push({
      id: plan.id,
      name: plan.name,
      category: plan.category,
      description: plan.description,
      version: plan.version,
      sectionNames,
      itemCount: count,
      // usageCount intentionally left undefined — the store computes it.
    });
  }
  return { templates, items };
}

// ---------------------------------------------------------------------------
// 4. Inspections (36) — explicit plan so every tab count is reproducible
// ---------------------------------------------------------------------------

interface InsSpec {
  readonly date: string;
  readonly status: InspectionStatus;
  readonly priority: Priority;
  readonly tmpl: number;      // TMPL-xx (1-based)
  readonly start: string;     // HH:MM
  readonly dur: number;       // minutes, 60–180
}

const INS_SPECS: readonly InsSpec[] = [
  // --- Completed (15) — scheduled 01 Sep … 02 Oct 2026 ---------------------
  { date: '2026-09-01', status: 'Completed', priority: 'High',   tmpl: 2,  start: '09:00', dur: 120 },
  { date: '2026-09-03', status: 'Completed', priority: 'Normal', tmpl: 3,  start: '10:00', dur: 90 },
  { date: '2026-09-05', status: 'Completed', priority: 'Normal', tmpl: 4,  start: '09:30', dur: 90 },
  { date: '2026-09-08', status: 'Completed', priority: 'Low',    tmpl: 5,  start: '11:00', dur: 120 },
  { date: '2026-09-10', status: 'Completed', priority: 'High',   tmpl: 6,  start: '09:00', dur: 150 },
  { date: '2026-09-12', status: 'Completed', priority: 'Normal', tmpl: 7,  start: '14:00', dur: 90 },
  { date: '2026-09-15', status: 'Completed', priority: 'Normal', tmpl: 8,  start: '10:30', dur: 120 },
  { date: '2026-09-17', status: 'Completed', priority: 'Low',    tmpl: 9,  start: '09:00', dur: 120 },
  { date: '2026-09-19', status: 'Completed', priority: 'Normal', tmpl: 10, start: '13:00', dur: 90 },
  { date: '2026-09-21', status: 'Completed', priority: 'High',   tmpl: 1,  start: '09:00', dur: 180 },
  { date: '2026-09-23', status: 'Completed', priority: 'Normal', tmpl: 2,  start: '10:00', dur: 105 },
  { date: '2026-09-26', status: 'Completed', priority: 'Low',    tmpl: 3,  start: '09:30', dur: 120 },
  { date: '2026-09-30', status: 'Completed', priority: 'Low',    tmpl: 5,  start: '11:00', dur: 90 },
  { date: '2026-10-01', status: 'Completed', priority: 'Normal', tmpl: 7,  start: '09:00', dur: 120 },
  { date: '2026-10-02', status: 'Completed', priority: 'High',   tmpl: 9,  start: '10:00', dur: 120 },
  // --- In Progress (3) — today (all TMPL-01 for the reference design) ------
  { date: DEMO_TODAY, status: 'In Progress', priority: 'High',   tmpl: 1, start: '09:00', dur: 150 },
  { date: DEMO_TODAY, status: 'In Progress', priority: 'Normal', tmpl: 1, start: '10:00', dur: 120 },
  { date: DEMO_TODAY, status: 'In Progress', priority: 'Low',    tmpl: 1, start: '11:00', dur: 90 },
  // --- Pending Submission (2) — today (all TMPL-01) -----------------------
  { date: DEMO_TODAY, status: 'Pending Submission', priority: 'High',   tmpl: 1, start: '08:30', dur: 120 },
  { date: DEMO_TODAY, status: 'Pending Submission', priority: 'Normal', tmpl: 1, start: '09:30', dur: 180 },
  // --- base Upcoming with PAST dates → derive to Overdue (4) ---------------
  { date: '2026-09-28', status: 'Upcoming', priority: 'Normal', tmpl: 4, start: '09:00', dur: 120 },
  { date: '2026-09-29', status: 'Upcoming', priority: 'High',   tmpl: 1, start: '10:00', dur: 90 },
  { date: '2026-10-01', status: 'Upcoming', priority: 'Normal', tmpl: 6, start: '11:00', dur: 90 },
  { date: '2026-10-02', status: 'Upcoming', priority: 'Low',    tmpl: 8, start: '09:30', dur: 120 },
  // --- base Upcoming with FUTURE dates → stay Upcoming (10) ---------------
  { date: '2026-10-04', status: 'Upcoming', priority: 'Normal', tmpl: 1, start: '09:00', dur: 120 },
  { date: '2026-10-05', status: 'Upcoming', priority: 'Normal', tmpl: 4, start: '10:00', dur: 90 },
  { date: '2026-10-07', status: 'Upcoming', priority: 'High',   tmpl: 1, start: '09:30', dur: 150 },
  { date: '2026-10-09', status: 'Upcoming', priority: 'Normal', tmpl: 6, start: '11:00', dur: 90 },
  { date: '2026-10-12', status: 'Upcoming', priority: 'Low',    tmpl: 2, start: '09:00', dur: 120 },
  { date: '2026-10-16', status: 'Upcoming', priority: 'Normal', tmpl: 1, start: '10:00', dur: 120 },
  { date: '2026-10-21', status: 'Upcoming', priority: 'Normal', tmpl: 5, start: '13:00', dur: 90 },
  { date: '2026-10-27', status: 'Upcoming', priority: 'Normal', tmpl: 3, start: '09:00', dur: 120 },
  { date: '2026-11-03', status: 'Upcoming', priority: 'Low',    tmpl: 1, start: '10:30', dur: 90 },
  { date: '2026-11-15', status: 'Upcoming', priority: 'Normal', tmpl: 7, start: '09:00', dur: 180 },
  // --- Cancelled (2) — past dates with cancellation bookkeeping ------------
  { date: '2026-09-22', status: 'Cancelled', priority: 'Normal', tmpl: 10, start: '10:00', dur: 90 },
  { date: '2026-09-25', status: 'Cancelled', priority: 'Normal', tmpl: 4,  start: '09:00', dur: 120 },
];

/** Base-Upcoming records that must present as Overdue on 03 Oct 2026. */
const OVERDUE_DATES: readonly string[] = ['2026-09-28', '2026-09-29', '2026-10-01', '2026-10-02'];

/** How many of the 56 TMPL-01 items each In Progress inspection has answered (60–75%). */
const IN_PROGRESS_ANSWERED: Record<string, number> = {
  'INS-2026-016': 38,   // 68 %
  'INS-2026-017': 41,   // 73 %
  'INS-2026-018': 36,   // 64 %
};

/**
 * Pending Submission — local item indexes deliberately left unanswered.
 * INS-2019 leaves TWO mandatory Closing Remarks lines open so a submission
 * attempt is legitimately blocked; INS-2020 leaves only optional lines open.
 */
const PENDING_SKIPPED: Record<string, number[]> = {
  'INS-2026-019': [50, 52, 54],   // 50 & 52 are mandatory → submission blocked
  'INS-2026-020': [53, 54, 55],   // all optional → submission could succeed
};

const CANCEL_REASONS: readonly string[] = [
  'Mine declared a full stop for monsoon restoration work on the scheduled date; slot released by the mine office.',
  'Working section handed over to the blasting crew — the inspection slot was withdrawn after coordination.',
  'Inspector deputed to an emergency inquiry on the same day; the visit was cancelled and a fresh slot requested.',
];

const LOCATION_DESC_TPL: readonly string[] = [
  '{zone} at {site} ({code}) — approached from the main haul-road ramp with dumper movement in progress.',
  'Working area around {zone}, {area} of {site}; escorted by the mine safety officer from the dispatch office.',
  '{zone} section of {code} visited during the day shift with light vehicles sharing the dumper approach road.',
  'On-site verification at {zone} — {district} property of {site}, with the crush line running intermittently.',
  '{zone} inspected from crest to toe; the {area} remained under active production at the time of visit.',
  'Field visit to {zone} at {site} ({code}); visibility good and the section approach ramp in usable condition.',
  'Survey walk through {zone}, part of the {area} of {site}; shift supervisors accompanied the inspector throughout.',
  '{zone} of {code} — all activities proceeding normally under the current sanctioned mining scheme.',
];

const GENERAL_REMARKS: readonly string[] = [
  'General condition of the area is satisfactory; housekeeping around the working face needs sustained attention.',
  'Shift personnel were cooperative and produced the statutory records on demand without delay.',
  'Drainage and sump arrangements reviewed post-monsoon and found adequate for the current rainfall.',
  'Two housekeeping observations recorded; the responsible supervisor was briefed on the spot.',
  'Equipment and records checked during this visit were broadly compliant with the sanctioned scheme.',
  'Blasting was suspended during the visit; magazine and exclusion-zone arrangements were verified separately.',
  'Crew strength matched the muster roll — no unauthorised person was found in the working area.',
  'Lighting and visibility at the section were adequate for safe working during the inspected shift.',
  'Previous visit observations were found closed except one item carried over with the mine office.',
  'No untoward incident was reported during the visit; the section was handed back to the shift in-charge.',
];

const SAFETY_POOL: readonly SafetyCondition[] = ['Normal', 'Normal', 'Normal', 'Caution', 'Caution', 'Hazardous'];

/** Site Details — complete for started/completed records, empty for not-started ones. */
function buildSiteDetails(
  insp: Omit<Inspection, 'siteDetails'>,
  site: MineSite,
  started: boolean,
): SiteDetails {
  const vars: Record<string, string> = {
    zone: insp.location, site: site.name, code: site.code, area: site.area, district: site.district,
  };
  if (!started) {
    return {
      weather: '',
      safetyConditions: '',
      locationDescription: '',
      inspectionDate: insp.scheduledDate,
      startTime: '',
      endTime: '',
      inspectorId: CURRENT_USER,
      crewStrength: null,
      generalRemarks: '',
      completedAt: null,
    };
  }
  const complete = insp.status === 'Completed';
  return {
    weather: pickBy(WEATHER_OPTIONS, `${insp.id}-weather`),
    safetyConditions: pickBy(SAFETY_POOL, `${insp.id}-cond`),
    locationDescription: tpl(pickBy(LOCATION_DESC_TPL, `${insp.id}-loc`), vars),
    inspectionDate: insp.scheduledDate,
    startTime: insp.startTime,
    endTime: insp.endTime,
    inspectorId: CURRENT_USER,
    crewStrength: 8 + (hashOf(`${insp.id}-crew`) % 38),   // 8 … 45
    generalRemarks: pickBy(GENERAL_REMARKS, `${insp.id}-rem`),
    completedAt: complete ? insp.submittedAt ?? null : null,
  };
}

/** Fresh inspections; `reportId` is stamped later by the report builder. */
function buildInspections(sites: MineSite[]): Inspection[] {
  return INS_SPECS.map((spec, i) => {
    const site = sites[i % sites.length];
    const location = site.zones[i % site.zones.length];
    const type = INSPECTION_TYPES[i % INSPECTION_TYPES.length];
    const id = `INS-2026-${pad(i + 1)}`;
    const end = plusMins(spec.start, spec.dur);
    const active = spec.status === 'In Progress' || spec.status === 'Pending Submission';
    const started = active || spec.status === 'Completed';
    const templateId = `TMPL-${pad(spec.tmpl, 2)}`;
    const createdAt = at(
      addDays(spec.date, -(4 + (i % 10))),
      plusMins('09:00', (pickIndex(`${id}-created`, 8) * 60) + ((i * 7) % 60)),
    );
    const title = `${type} — ${location}`;
    const objective =
      `${type} of the ${location} at ${site.name} (${site.code}), ${site.district}, scheduled under the demonstration DGMS calendar for ${fmtDate(spec.date)}. ` +
      `Verify statutory compliance, safe working practice and record keeping against the ${TEMPLATE_PLANS[spec.tmpl - 1].name}, documenting every observation with evidence.`;

    const base: Omit<Inspection, 'siteDetails'> = {
      id,
      title,
      mineId: site.id,
      location,
      type,
      priority: spec.priority,
      status: spec.status,
      scheduledDate: spec.date,
      startTime: spec.start,
      endTime: end,
      durationMins: spec.dur,
      assignedTo: CURRENT_USER,
      assignedBy: ASSIGNERS[i % ASSIGNERS.length],
      objective,
      templateId,
      workflowStep:
        spec.status === 'Completed' || spec.status === 'Pending Submission' ? 3
          : spec.status === 'In Progress' ? (i % 2 === 0 ? 1 : 2)
            : 0,
      requiredEvidenceCount: 3 + (i % 4),   // 3 … 6
      createdAt,
      startedAt: active ? at(DEMO_TODAY, spec.start) : spec.status === 'Completed' ? at(spec.date, spec.start) : null,
      lastSavedAt: started ? at(spec.status === 'Completed' ? spec.date : DEMO_TODAY, end) : null,
      submittedAt: spec.status === 'Completed' ? at(spec.date, plusMins(end, 10)) : null,
      cancelledAt: spec.status === 'Cancelled' ? at(addDays(spec.date, -2), '16:20') : null,
      cancelReason: spec.status === 'Cancelled' ? pickBy(CANCEL_REASONS, id) : null,
      reportId: null,
    };
    return { ...base, siteDetails: buildSiteDetails(base, site, started) };
  });
}

// ---------------------------------------------------------------------------
// 5. Evidence (exactly 25) — DEMO-FILE:// refs only (no real assets exist)
// ---------------------------------------------------------------------------

interface EvSpec {
  readonly ins: number;     // inspection index in INS_SPECS order
  readonly local: number;   // item index inside that inspection's template
  readonly type: EvidenceType;
  readonly title: string;
  readonly desc: string;
  readonly file: string;
  readonly sizeKb: number;  // 45 … 8400
  readonly offset: number;  // minutes after the inspection start time
}

const EVIDENCE_SPECS: readonly EvSpec[] = [
  // --- on the 5 active inspections (8 records) -----------------------------
  { ins: 15, local: 7, type: 'Photo', title: 'Haul road edge berms at chainage 1.2 km',
    desc: 'Edge berm on the dispatch haul road measured about 0.55 m at chainage 1.2 km and two reflector posts were missing. Shot from the dumper turnaround point.',
    file: 'IMG_20261003_0942.jpg', sizeKb: 2450, offset: 42 },
  { ins: 15, local: 14, type: 'Photo', title: 'Water spray nozzles on the GCD approach road',
    desc: 'Three of the eight spray nozzles on the GCD approach road were choked and a dust plume was visible near the tipper entry.',
    file: 'IMG_20261003_1017.jpg', sizeKb: 2210, offset: 77 },
  { ins: 16, local: 6, type: 'Photo', title: 'PPE check at the East Pit entry ramp',
    desc: 'Dump-truck operators entering the pit were wearing helmets and reflective jackets; one walk-along supervisor had no safety shoes.',
    file: 'IMG_20261003_1038.jpg', sizeKb: 1980, offset: 38 },
  { ins: 16, local: 21, type: 'Inspector Note', title: 'Guard fastener observation — crusher feed',
    desc: 'Hand note recorded about a missing fastener on the crusher feed guard; the duty fitter was asked to replace it before the evening shift.',
    file: 'site_note_1102.txt', sizeKb: 48, offset: 62 },
  { ins: 17, local: 8, type: 'Photo', title: 'Loose overhang above the working bench',
    desc: 'Loose material hanging above the active bench face on the western side, within reach of the shovel loading path.',
    file: 'IMG_20261003_1142.jpg', sizeKb: 2640, offset: 42 },
  { ins: 17, local: 10, type: 'Document', title: 'First-aid room register and drug stock',
    desc: 'Register shows daily counter checks; two entries for injectables were left without the ward attendant’s signature.',
    file: 'first_aid_register.pdf', sizeKb: 640, offset: 66 },
  { ins: 18, local: 16, type: 'Video Reference', title: 'Walkthrough of the workshop soak-pit channel',
    desc: 'Ninety-second walkthrough following the workshop effluent channel up to the soak pit, showing a faint oily film at the outlet.',
    file: 'walkthrough_1015.mp4', sizeKb: 6900, offset: 105 },
  { ins: 19, local: 6, type: 'Document', title: 'PPE issue register — contractor crew',
    desc: 'Issue register for the contractor crew with helmet and shoe receipts for the current quarter; three signatures are pending.',
    file: 'ppe_issue_register.pdf', sizeKb: 810, offset: 90 },
  // --- spread across completed inspections (17 records) --------------------
  { ins: 0, local: 1, type: 'Photo', title: 'Dust suppression sprays on haul road H2',
    desc: 'Spray line along haul road H2 running at reduced pressure with two nozzles dry during the visit.',
    file: 'IMG_20260901_0937.jpg', sizeKb: 2080, offset: 37 },
  { ins: 1, local: 1, type: 'Photo', title: 'Emergency pull-cord switch at Conveyor Gallery 2',
    desc: 'Pull-cord switch at the gallery mid-span with the identification tag faded but the trip action confirmed on test.',
    file: 'IMG_20260903_1024.jpg', sizeKb: 1740, offset: 24 },
  { ins: 2, local: 7, type: 'Document', title: 'Specialty certification folder — contractor crew',
    desc: 'Folder of explosive-handling and working-at-height certificates for the tagged contractor crew sampled on site.',
    file: 'specialty_certs.pdf', sizeKb: 1120, offset: 44 },
  { ins: 3, local: 0, type: 'Photo', title: 'Marked evacuation route from the pit bottom',
    desc: 'Way-band arrows painted along the pit-bottom escape route up to the surface assembly point, with one panel obscured by dust.',
    file: 'IMG_20260908_1131.jpg', sizeKb: 2360, offset: 31 },
  { ins: 3, local: 4, type: 'Photo', title: 'Emergency lighting at the gallery stair',
    desc: 'Battery exit light above the conveyor gallery stair switched on during the isolation test and illuminating the landing.',
    file: 'IMG_20260908_1202.jpg', sizeKb: 1985, offset: 62 },
  { ins: 4, local: 8, type: 'Photo', title: 'Tagged scaffolding at Workshop Bay 2',
    desc: 'Scaffold bay at Workshop Bay 2 carrying a dated inspection tag with the scaffolder’s signature legible.',
    file: 'IMG_20260910_0952.jpg', sizeKb: 2140, offset: 52 },
  { ins: 5, local: 0, type: 'Photo', title: 'Earthing pit with continuity test tag',
    desc: 'Earthing pit near the MCC with the continuity test tag showing the last reading inside the permitted range.',
    file: 'IMG_20260912_1428.jpg', sizeKb: 1860, offset: 28 },
  { ins: 6, local: 2, type: 'Document', title: 'Magazine issue and return register extract',
    desc: 'Extract of the magazine register showing the day’s issue, return and closing balance tallied by the stores-in-charge.',
    file: 'magazine_register.pdf', sizeKb: 720, offset: 35 },
  { ins: 6, local: 5, type: 'Photo', title: 'Shot-firing exclusion zone signage',
    desc: 'Danger board mounted at the exclusion-zone approach with the firing circle and sentry position marked on the plan board.',
    file: 'IMG_20260915_1114.jpg', sizeKb: 2050, offset: 44 },
  { ins: 7, local: 1, type: 'Photo', title: 'Crest crack on the external OB dump',
    desc: 'Tension crack running about four metres along the crest of the external overburden dump, barricaded and under watch.',
    file: 'IMG_20260917_0948.jpg', sizeKb: 2540, offset: 48 },
  { ins: 7, local: 3, type: 'Photo', title: 'Erosion gully on the dump face after rain',
    desc: 'Rain-cut gully developing on the dump face above the toe berm following the last spell of rain.',
    file: 'IMG_20260917_1035.jpg', sizeKb: 2320, offset: 95 },
  { ins: 8, local: 7, type: 'Document', title: 'Statutory test certificates — electrical and lifting',
    desc: 'Bundle of electrical test reports and lifting-gear certificates for the plant sampled during the visit.',
    file: 'statutory_test_certs.pdf', sizeKb: 1480, offset: 40 },
  { ins: 9, local: 6, type: 'Photo', title: 'PPE compliance at the dip side working',
    desc: 'Crew at the dip side working photographed during the PPE round — helmets, jackets and shoes in order for all present persons.',
    file: 'IMG_20260921_0944.jpg', sizeKb: 1995, offset: 44 },
  { ins: 9, local: 50, type: 'Inspector Note', title: 'Closing remarks recorded in the visit register',
    desc: 'Hand note of the closing remarks read out to the mine management before departure, countersigned in the visit register.',
    file: 'site_note_1215.txt', sizeKb: 62, offset: 168 },
  { ins: 11, local: 2, type: 'Photo', title: 'Interlocked access gate on the screen house',
    desc: 'Screen-house access gate with the limit switch wired to the starter; gate opening stopped the drive during the test.',
    file: 'IMG_20260926_1012.jpg', sizeKb: 2115, offset: 42 },
  { ins: 13, local: 1, type: 'Video Reference', title: 'MCC earthing busbar walkthrough',
    desc: 'Short walkthrough of the MCC earthing busbar showing numbered earth connections and one untagged spare way.',
    file: 'walkthrough_0935.mp4', sizeKb: 7450, offset: 35 },
  { ins: 14, local: 0, type: 'Photo', title: 'Bench face and batter slope profile',
    desc: 'Wide shot of the bench face and batter profile recorded to compare against the approved working geometry.',
    file: 'IMG_20261002_1048.jpg', sizeKb: 2680, offset: 48 },
];

function buildEvidence(inspections: Inspection[], items: ChecklistItemDef[]): Evidence[] {
  const itemByTemplate = new Map<string, ChecklistItemDef[]>();
  for (const item of items) {
    const list = itemByTemplate.get(item.templateId);
    if (list) list.push(item);
    else itemByTemplate.set(item.templateId, [item]);
  }
  return EVIDENCE_SPECS.map((spec, k) => {
    const insp = inspections[spec.ins];
    const templateItems = itemByTemplate.get(insp.templateId) ?? [];
    const linked = templateItems[spec.local];
    const id = `EVD-${pad(k + 1)}`;
    return {
      id,
      inspectionId: insp.id,
      itemId: linked ? linked.id : null,
      type: spec.type,
      title: spec.title,
      description: spec.desc,
      capturedAt: at(insp.scheduledDate, plusMins(insp.startTime, spec.offset)),
      location: insp.location,
      fileRef: `DEMO-FILE://minenetr/evidence/${id}`,
      fileName: spec.file,
      sizeKb: spec.sizeKb,
      uploadedBy: CURRENT_USER,
    };
  });
}

// ---------------------------------------------------------------------------
// 6. Checklist responses
// ---------------------------------------------------------------------------

const NC_REMARKS: readonly string[] = [
  'Berms below the required height near the turn-around; reflector posts missing at two points.',
  'Two persons observed without safety shoes in the active zone — briefed on the spot and the supervisor informed.',
  'Spray nozzles choked at three locations; dust plume visible on the approach road.',
  'Panel door found open with live terminals exposed — closed immediately and the electrician called.',
  'Guard fastener missing at the feed opening; the machine was stopped until replacement was arranged.',
  'Register entry missing for the last shift — the overman was asked to complete the record the same day.',
  'Drainage channel blocked with overburden debris; water ponding near the working bench.',
  'Fire extinguisher at the DG set yard has crossed its due date — replacement directed within two days.',
  'Crest signage faded beyond legibility — replacement ordered by the mine office.',
  'Oily film noticed at the workshop effluent outlet — interceptor cleaning directed on the spot.',
  'Emergency contact board still lists a transferred officer — update directed during the visit.',
  'RCCB trip could not be demonstrated for two outgoing feeders — retest scheduled with the electrical supervisor.',
];

const NA_REMARKS: readonly string[] = [
  'Not applicable to this section — the activity is not carried out at the visited location.',
  'No blast was scheduled inside the visit window, so shot-firing controls were not observable.',
  'Area handed over to reclamation; production activity no longer takes place here.',
  'Equipment idle in the workshop and electrically isolated, so operational checks were not applicable.',
  'Drainage work completed and the channel decommissioned — the check is not relevant for this cycle.',
  'Contract crew not deployed on this date, so contractor-specific checks were kept not applicable.',
  'Installation is under removal; verification deferred to the next inspection cycle.',
  'Stand-by arrangement not in use during fair weather — the check was marked not applicable.',
];

const COMPLIANT_REMARKS: readonly string[] = [
  'Found in order during the walk-through.',
  'Records produced on demand and found current.',
  'Observed satisfactory in person with the shift in-charge present.',
  'Verified against the sanctioned plan — no deviation noticed.',
];

/** ~12 % Non-Compliant, ~7 % Not Applicable, rest Compliant (deterministic). */
function responseValueFor(key: string): ChecklistResponseValue {
  const r = unit(key);
  if (r < 0.12) return 'Non-Compliant';
  if (r < 0.19) return 'Not Applicable';
  return 'Compliant';
}

function buildResponses(
  inspections: Inspection[],
  items: ChecklistItemDef[],
  evidence: Evidence[],
): ChecklistResponse[] {
  const itemByTemplate = new Map<string, ChecklistItemDef[]>();
  for (const item of items) {
    const list = itemByTemplate.get(item.templateId);
    if (list) list.push(item);
    else itemByTemplate.set(item.templateId, [item]);
  }
  // evidence ids already linked to a (inspection, item) pair
  const evByPair = new Map<string, string[]>();
  for (const ev of evidence) {
    if (!ev.itemId) continue;
    const key = `${ev.inspectionId}|${ev.itemId}`;
    const list = evByPair.get(key);
    if (list) list.push(ev.id);
    else evByPair.set(key, [ev.id]);
  }

  const answered = (insp: Inspection, local: number): boolean => {
    if (insp.status === 'Completed') return true;                       // 0 "Not Checked"
    if (insp.status === 'In Progress') return local < (IN_PROGRESS_ANSWERED[insp.id] ?? 0);
    if (insp.status === 'Pending Submission') return !(PENDING_SKIPPED[insp.id] ?? []).includes(local);
    return false;                                                       // Upcoming / Cancelled: none
  };

  const out: ChecklistResponse[] = [];
  let seq = 0;
  for (const insp of inspections) {
    const templateItems = itemByTemplate.get(insp.templateId) ?? [];
    const stamp = insp.submittedAt ?? insp.lastSavedAt ?? insp.createdAt;
    for (let local = 0; local < templateItems.length; local++) {
      const item = templateItems[local];
      if (!answered(insp, local)) continue;
      seq += 1;
      const key = `${insp.id}|${item.id}`;
      const value = responseValueFor(key);
      const remarks =
        value === 'Non-Compliant' ? pickBy(NC_REMARKS, `${key}-nc`)
          : value === 'Not Applicable' ? pickBy(NA_REMARKS, `${key}-na`)
            : unit(`${key}-cr`) < 0.18 ? pickBy(COMPLIANT_REMARKS, `${key}-ok`)
              : '';
      out.push({
        id: `RESP-${pad(seq, 4)}`,
        inspectionId: insp.id,
        itemId: item.id,
        section: item.section,
        response: value,
        remarks,
        evidenceIds: [...(evByPair.get(key) ?? [])],
        updatedAt: stamp,
        updatedBy: CURRENT_USER,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 7. Findings (20 — every one anchored to a real Non-Compliant response)
// ---------------------------------------------------------------------------

const FINDING_STATUS_PLAN: readonly FindingStatusValue[] = [
  'Open', 'Open', 'Under Review', 'Corrective Action Required', 'Open',
  'Resolved', 'Under Review', 'Open', 'Corrective Action Required', 'Resolved',
  'Open', 'Under Review', 'Corrective Action Required', 'Open', 'Resolved',
  'Under Review', 'Corrective Action Required', 'Resolved', 'Open', 'Under Review',
];

const FINDING_SEVERITY_PLAN: readonly Severity[] = [
  Severity.High, Severity.Medium, Severity.Low, Severity.Critical, Severity.High,
  Severity.Medium, Severity.Low, Severity.High, Severity.Medium, Severity.Critical,
  Severity.Low, Severity.Medium, Severity.High, Severity.Low, Severity.Medium,
  Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.High,
];

const ASSIGNEE_ROLES: readonly string[] = [
  'Mine Manager', 'Safety Officer', 'Ventilation Officer', 'Electrical Supervisor',
  'Workshop In-charge', 'Environmental Officer', 'Contractor Manager', 'Dispatch In-charge',
];

const RECOMMENDATIONS: readonly string[] = [
  'Rectify the deficiency before the next working shift and upload photographic closure evidence against this finding.',
  'Restore the arrangement to the approved standard, brief the shift crew on the required practice and record the briefing.',
  'Carry out the corrective maintenance, update the equipment log and place the clearance entry before duty resumes.',
  'Complete the record on the same day, train the concerned supervisor on the entry format and re-verify at the next visit.',
  'Submit a time-bound corrective plan to the inspector’s office within seven days and close the item with evidence.',
  'Replace the defective or missing arrangement, re-inspect it jointly with the safety officer and note the result in the register.',
  'Redesign the defective layout to the sanctioned geometry and obtain the planning office’s approval before further work.',
  'Arrange the outstanding statutory test, file the certificate on site and flag it in the statutory compliance tracker.',
  'Instruct the contractor to restore housekeeping standards and report compliance in the next toolbox talk record.',
  'Restore serviceability, re-run the functional test in the presence of the inspector and attach the test sheet for closure.',
];

function categoryFor(templateCategory: string, key: string): FindingCategory {
  switch (templateCategory) {
    case 'Environmental': return FindingCategory.Environment;
    case 'Machinery & Electrical': return FindingCategory.Equipment;
    case 'Worker & Contractor': return FindingCategory.WorkerWelfare;
    case 'Statutory Records': return FindingCategory.Documentation;
    default: return unit(`${key}-other`) < 0.08 ? FindingCategory.Other : FindingCategory.Safety;
  }
}

function buildFindings(
  sites: MineSite[],
  inspections: Inspection[],
  items: ChecklistItemDef[],
  templates: ChecklistTemplate[],
  responses: ChecklistResponse[],
  evidence: Evidence[],
): InspectionFinding[] {
  const inspById = new Map(inspections.map((x) => [x.id, x]));
  const itemById = new Map(items.map((x) => [x.id, x]));
  const tmplById = new Map(templates.map((x) => [x.id, x]));
  const siteById = new Map(sites.map((x) => [x.id, x]));

  // Every Non-Compliant response is a candidate finding, in stable order.
  const ncPairs = responses
    .filter((r) => r.response === 'Non-Compliant')
    .map((r) => ({ inspId: r.inspectionId, itemId: r.itemId }));
  const selected = evenSample(ncPairs, 20);

  return selected.map((pair, k) => {
    const insp = inspById.get(pair.inspId);
    const item = itemById.get(pair.itemId);
    const site = insp ? siteById.get(insp.mineId) : undefined;
    const key = `${pair.inspId}|${pair.itemId}`;
    const remark = pickBy(NC_REMARKS, `${key}-nc`);
    const template = insp ? tmplById.get(insp.templateId) : undefined;
    const source =
      k % 9 === 5 ? FindingSource.SensorAlert
        : k % 7 === 3 ? FindingSource.AIDetection
          : FindingSource.Inspector;
    const detectedAt = insp ? (insp.startedAt ?? insp.createdAt) : at(DEMO_TODAY, '09:00');
    const detectedDate = detectedAt.slice(0, 10);
    const dueDate = addDays(detectedDate, 3 + (k % 13));   // +3 … +15 days
    const inspEvidence = evidence.filter((e) => e.inspectionId === pair.inspId).slice(0, 2);
    return {
      id: `FND-2026-${pad(k + 1)}`,
      mineId: site ? site.id : '',
      inspectionId: pair.inspId,
      inspectorId: CURRENT_USER,
      category: categoryFor(template ? template.category : 'Safety Inspections', key),
      severity: FINDING_SEVERITY_PLAN[k],
      status: FINDING_STATUS_PLAN[k],
      source,
      location: insp ? insp.location : '',
      description: item
        ? `Requirement not met — ${item.requirement}. Observation on site: ${remark}`
        : `Observation on site: ${remark}`,
      recommendation: pickBy(RECOMMENDATIONS, `${key}-rec`),
      assignee: `${pickBy(ASSIGNEE_ROLES, `${key}-asg`)}, ${site ? site.code : 'BCM-01'}`,
      detectedAt,
      dueDate,
      evidence: inspEvidence.map((e) => e.id),
      itemId: pair.itemId,
      verifiedHuman: source === FindingSource.Inspector,
    };
  });
}

// ---------------------------------------------------------------------------
// 8. Reports (exactly 15 — one per Completed inspection, counts computed)
// ---------------------------------------------------------------------------

const REPORT_STATUS_PLAN: readonly ReportStatusValue[] = [
  'Submitted', 'Under Review', 'Approved', 'Changes Requested',
];

function buildReports(
  inspections: Inspection[],
  responses: ChecklistResponse[],
  evidence: Evidence[],
  findings: InspectionFinding[],
): InspectionReport[] {
  const completed = inspections.filter((i) => i.status === 'Completed');
  return completed.map((insp, i) => {
    const rs = responses.filter((r) => r.inspectionId === insp.id);
    const counts = {
      compliant: rs.filter((r) => r.response === 'Compliant').length,
      nonCompliant: rs.filter((r) => r.response === 'Non-Compliant').length,
      notApplicable: rs.filter((r) => r.response === 'Not Applicable').length,
      notChecked: rs.filter((r) => r.response === 'Not Checked').length,
      evidence: evidence.filter((e) => e.inspectionId === insp.id).length,
      findings: findings.filter((f) => f.inspectionId === insp.id).length,
    };
    const status = REPORT_STATUS_PLAN[i % REPORT_STATUS_PLAN.length];
    const submittedAt = insp.submittedAt ?? insp.createdAt;
    const report: InspectionReport = {
      id: `RPT-${pad(i + 1)}`,
      inspectionId: insp.id,
      mineId: insp.mineId,
      type: insp.type,
      title: `Inspection Report — ${insp.location} · ${fmtDate(insp.scheduledDate)}`,
      status,
      version: 1 + (i % 3),           // 1 … 3
      inspectorId: CURRENT_USER,
      submittedAt,
      reviewedAt: status === 'Submitted' ? null : at(addDays(insp.scheduledDate, 3), '15:10'),
      summary:
        `The ${fmtDate(insp.scheduledDate)} visit to ${insp.location} verified ${rs.length} checklist lines, with ${counts.compliant} compliant, ` +
        `${counts.nonCompliant} non-compliant and ${counts.notApplicable} marked not applicable. ` +
        `${counts.evidence} evidence records and ${counts.findings} findings are attached for the reviewing officer. ` +
        `Observations were discussed with the mine management on site before the report was submitted.`,
      counts,
    };
    insp.reportId = report.id;   // fresh object per call — safe to stamp here
    return report;
  });
}

// ---------------------------------------------------------------------------
// 9. Notes (16 — spread over the 5 active + 11 completed inspections)
// ---------------------------------------------------------------------------

const ACTIVE_NOTE_BODIES: readonly string[] = [
  'Reached the section at the scheduled time; the shift in-charge has produced the statutory registers without delay.',
  'Half the checklist is done — haul road and bench observations photographed, awaiting the electrical supervisor for panel checks.',
  'Crew strength on site matches the muster roll; continuing with the emergency preparedness lines after lunch.',
  'Pending items are the closing remarks and the management acknowledgement — both to be completed before submission.',
  'Weather turned partly cloudy by midday; no impact on the inspection scope or on housekeeping observations.',
  'One non-compliance already flagged against the dust suppression line — mine office has been informed informally.',
];

const COMPLETED_NOTE_BODIES: readonly string[] = [
  'Walk-through completed with the mine safety officer; all records were produced on demand and closure points noted.',
  'Two observations were discussed with the manager’s representative and a corrective timeline was agreed on the spot.',
  'Magazine register tallied personally with the stores-in-charge — issue, return and closing balance matched.',
  'Previous visit follow-up checked: four of five observations closed, one carried over with the mine office.',
  'Effluent channel traced up to the soak pit; interceptor cleaning directed and noted in the report.',
  'Blasting was suspended during the visit, so shot-firing controls were verified from records and signage instead.',
  'Panel room inspected with the electrical supervisor; two feeders await a repeat RCCB trip test.',
  'Housekeeping at the dispatch yard needs sustained attention — raised as a low-severity finding.',
  'Drill record reviewed for the quarter; participation sheet complete and lessons incorporated in the plan.',
  'Dump crest walked end to end — one tension crack located, barricaded and flagged for weekly monitoring.',
  'Report submitted after briefing the shift crew on the flagged items; management acknowledgement taken in the register.',
];

function buildNotes(inspections: Inspection[]): InspectionNote[] {
  const plan: { idx: number; active: boolean }[] = [
    { idx: 15, active: true }, { idx: 16, active: true }, { idx: 17, active: true },
    { idx: 18, active: true }, { idx: 19, active: true },
    { idx: 0, active: false }, { idx: 1, active: false }, { idx: 2, active: false },
    { idx: 3, active: false }, { idx: 4, active: false }, { idx: 5, active: false },
    { idx: 6, active: false }, { idx: 7, active: false }, { idx: 8, active: false },
    { idx: 9, active: false }, { idx: 14, active: false },
  ];
  return plan.map((entry, k) => {
    const insp = inspections[entry.idx];
    const body = entry.active
      ? ACTIVE_NOTE_BODIES[k % ACTIVE_NOTE_BODIES.length]
      : COMPLETED_NOTE_BODIES[(k - 5) % COMPLETED_NOTE_BODIES.length];
    const createdAt = entry.active
      ? at(DEMO_TODAY, plusMins(insp.startTime, 55 + k * 7))
      : at(insp.scheduledDate, plusMins(insp.endTime, 15 + k * 4));
    return {
      id: `NOTE-${pad(k + 1)}`,
      inspectionId: insp.id,
      body,
      authorId: CURRENT_USER,
      createdAt,
      updatedAt: k % 3 === 0 ? at(createdAt.slice(0, 10), '17:05') : createdAt,
      draft: k === 2 || k === 9,   // exactly 2 drafts
    };
  });
}

// ---------------------------------------------------------------------------
// 10. Documents (2–4 per inspection — synthetic DEMO files, always sample)
// ---------------------------------------------------------------------------

const DOC_ENTRIES: Record<DocumentCategory, { title: string; file: string }[]> = {
  'Safety SOP': [
    { title: 'Safety SOP — Pit Operations v2.0', file: 'safety_sop_v2.pdf' },
    { title: 'Safety SOP — Shot-firing & Magazine v1.4', file: 'safety_sop_shotfiring.pdf' },
  ],
  'Mine Layout': [
    { title: 'Mine Layout — {code} Working Plan', file: 'mine_layout_{code}.pdf' },
    { title: 'Mine Layout — Haul Road & Dump Geometry', file: 'mine_layout_{code}_haul.pdf' },
  ],
  'Previous Inspection Report': [
    { title: 'Previous Inspection Report — Sep 2026', file: 'prev_insp_report_sep26.pdf' },
    { title: 'Previous Inspection Report — Aug 2026', file: 'prev_insp_report_aug26.pdf' },
  ],
  'Equipment Checklist': [
    { title: 'Dumper Pre-Shift Checklist', file: 'dumper_checklist.xlsx' },
    { title: 'Crusher & Conveyor Daily Checklist', file: 'crusher_checklist.xlsx' },
  ],
  'Permit / Certificate': [
    { title: 'Shot-firing Permit — Oct 2026', file: 'blasting_permit_2026.pdf' },
    { title: 'Electrical Work Permit Register', file: 'electrical_permit.pdf' },
  ],
};

function buildDocuments(sites: MineSite[], inspections: Inspection[]): InspectionDocument[] {
  const siteById = new Map(sites.map((x) => [x.id, x]));
  const out: InspectionDocument[] = [];
  for (let i = 0; i < inspections.length; i++) {
    const insp = inspections[i];
    const site = siteById.get(insp.mineId);
    const count = 2 + (i % 3);   // 2 … 4 per inspection
    for (let j = 0; j < count; j++) {
      const category = DOCUMENT_CATEGORIES[(i + j) % DOCUMENT_CATEGORIES.length];
      const entry = DOC_ENTRIES[category][(i + Math.floor(j / 2)) % 2];
      const docId = `DOC-${pad(out.length + 1)}`;
      const code = site ? site.code.toLowerCase() : 'bcm-01';
      out.push({
        id: docId,
        inspectionId: insp.id,
        title: tpl(entry.title, { code: site ? site.code : 'BCM-01' }),
        category,
        fileRef: `DEMO-FILE://minenetr/docs/${docId}`,
        fileName: tpl(entry.file, { code }),
        sizeKb: 120 + ((i * 97 + j * 211) % 4300),
        updatedAt: insp.submittedAt ?? insp.createdAt,
        owner: CURRENT_USER,
        sample: true,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 11. Reschedule / reassign / cancel requests (6)
// ---------------------------------------------------------------------------

interface ReqSpec {
  readonly ins: number;                 // inspection index
  readonly kind: RequestKind;
  readonly status: RequestStatusValue;
  readonly reason: string;
  readonly toInspector?: string;
  readonly decidedBy?: string;
  readonly decisionNote?: string;
}

const REQUEST_SPECS: readonly ReqSpec[] = [
  {
    ins: 24, kind: 'Reschedule', status: 'Pending Approval',
    reason: 'The scheduled slot clashes with the blast-firing exclusion window declared by the mine office; a later slot is requested.',
  },
  {
    ins: 25, kind: 'Reassign', status: 'Pending Approval', toInspector: 'INSP-03',
    reason: 'The electrical installation enquiry at the neighbouring section falls in the same window, so reassignment is sought.',
  },
  {
    ins: 27, kind: 'Reschedule', status: 'Approved',
    reason: 'Approach road will be occupied by monsoon restoration dumping around the scheduled date.',
    decidedBy: 'INSP-01',
    decisionNote: 'Approved — moved to the next available slot after coordination with the mine manager.',
  },
  {
    ins: 29, kind: 'Cancel', status: 'Rejected',
    reason: 'Request to drop the visit as the area is already covered by the neighbouring section’s audit this month.',
    decidedBy: 'INSP-02',
    decisionNote: 'Rejected — the statutory quarterly visit must be completed within the current month; please propose a reassignment instead.',
  },
  {
    ins: 31, kind: 'Reschedule', status: 'Pending Approval',
    reason: 'The working section will be under dump stacking until the end of that week, so the inspection date needs review.',
  },
  {
    ins: 33, kind: 'Reassign', status: 'Approved', toInspector: 'INSP-04',
    reason: 'Mechanical-heavy scope of this visit is better covered by the mechanical inspector deputed from the regional office.',
    decidedBy: 'INSP-01',
    decisionNote: 'Approved — coverage reassigned for better subject-matter alignment; performer notified in the schedule.',
  },
];

function buildRequests(inspections: Inspection[]): RescheduleRequest[] {
  return REQUEST_SPECS.map((spec, k) => {
    const insp = inspections[spec.ins];
    const decided = spec.status !== 'Pending Approval';
    const created = at(addDays(insp.scheduledDate, -3), '17:05');
    return {
      id: `REQ-${pad(k + 1)}`,
      inspectionId: insp.id,
      kind: spec.kind,
      requestedBy: CURRENT_USER,
      fromDate: insp.scheduledDate,
      toDate: spec.kind === 'Reschedule' ? addDays(insp.scheduledDate, 6 + (k % 4)) : undefined,
      toInspector: spec.kind === 'Reassign' ? spec.toInspector : undefined,
      reason: spec.reason,
      status: spec.status,
      decidedBy: decided ? spec.decidedBy ?? 'INSP-01' : null,
      decidedAt: decided ? at(addDays(insp.scheduledDate, -2), '11:30') : null,
      decisionNote: decided ? spec.decisionNote ?? null : null,
      createdAt: created,
    };
  });
}

// ---------------------------------------------------------------------------
// 12. Activity trail (64 entries — 1–2 per inspection + request events)
// ---------------------------------------------------------------------------

function buildActivity(
  sites: MineSite[],
  inspections: Inspection[],
  templates: ChecklistTemplate[],
  responses: ChecklistResponse[],
  evidence: Evidence[],
  requests: RescheduleRequest[],
): InspectionActivity[] {
  const siteById = new Map(sites.map((x) => [x.id, x]));
  const tmplById = new Map(templates.map((x) => [x.id, x]));
  const nameOf = (id: string): string => INSPECTOR_DEFS.find((x) => x.id === id)?.name ?? id;
  const out: InspectionActivity[] = [];
  const push = (inspectionId: string, action: string, atIso: string, by: string, detail: string): void => {
    out.push({ id: `IACT-${pad(out.length + 1)}`, inspectionId, at: atIso, by, action, detail });
  };

  for (const insp of inspections) {
    const site = siteById.get(insp.mineId);
    const tmpl = tmplById.get(insp.templateId);
    // 1) always: scheduled / assigned
    push(
      insp.id,
      'Scheduled',
      insp.createdAt,
      nameOf(insp.assignedBy),
      `${insp.title} scheduled at ${site ? site.code : ''} for ${fmtDate(insp.scheduledDate)} against the ${tmpl ? tmpl.name : 'checklist'} and assigned to ${nameOf(insp.assignedTo)}.`,
    );
    // 2) status-specific follow-up
    if (insp.status === 'Completed') {
      const rs = responses.filter((r) => r.inspectionId === insp.id).length;
      const ev = evidence.filter((e) => e.inspectionId === insp.id).length;
      push(
        insp.id, 'Submitted', insp.submittedAt ?? insp.createdAt, nameOf(CURRENT_USER),
        `All ${rs} checklist lines answered at ${insp.location} and the report submitted for review with ${ev} evidence records.`,
      );
    } else if (insp.status === 'In Progress' || insp.status === 'Pending Submission') {
      push(
        insp.id, 'Started', insp.startedAt ?? insp.createdAt, nameOf(CURRENT_USER),
        `On-site verification started at ${insp.location}; site details, weather and crew strength recorded for the round.`,
      );
    } else if (insp.status === 'Cancelled') {
      push(
        insp.id, 'Cancelled', insp.cancelledAt ?? insp.createdAt, nameOf(insp.assignedBy),
        `Inspection cancelled before the visit — ${insp.cancelReason ?? 'reason recorded with the schedule.'}`,
      );
    }
  }
  // 3) one activity per reschedule / reassign / cancel request
  for (const req of requests) {
    const insp = inspections.find((x) => x.id === req.inspectionId);
    push(
      req.inspectionId,
      'Reschedule Requested',
      req.createdAt,
      nameOf(req.requestedBy),
      `${req.id} raised to ${req.kind.toLowerCase()} ${req.inspectionId} from ${fmtDate(req.fromDate)}; status ${req.status}.`,
    );
    if (insp) {
      // keep the entry self-describing even when the inspection is far out
      out[out.length - 1].detail += ` Concerning "${insp.title}".`;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Snapshot assembly
// ---------------------------------------------------------------------------

/**
 * Returns the complete synthetic dataset as a FRESH deep structure on every
 * call — no array or object reference is shared between calls, so callers may
 * mutate the snapshot freely without corrupting later reads.
 */
export function inspectionSnapshot(): InspectionSeedSnapshot {
  const sites: MineSite[] = SITE_DEFS.map((d) => ({ ...d, zones: [...d.zones] }));
  const inspectors: Inspector[] = INSPECTOR_DEFS.map((x) => ({ ...x }));
  const { templates, items } = buildTemplates();
  const inspections = buildInspections(sites);
  const evidence = buildEvidence(inspections, items);
  const responses = buildResponses(inspections, items, evidence);
  const findings = buildFindings(sites, inspections, items, templates, responses, evidence);
  const reports = buildReports(inspections, responses, evidence, findings);   // stamps inspection.reportId
  const notes = buildNotes(inspections);
  const documents = buildDocuments(sites, inspections);
  const requests = buildRequests(inspections);
  const activity = buildActivity(sites, inspections, templates, responses, evidence, requests);
  return {
    sites,
    inspectors,
    templates,
    items,
    inspections,
    responses,
    evidence,
    findings,
    reports,
    notes,
    documents,
    requests,
    activity,
  };
}






