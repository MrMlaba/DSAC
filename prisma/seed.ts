import crypto from "node:crypto";
import {
  PrismaClient,
  type Quarter,
  type Gender,
  type RaceCategory,
  type AgeBand,
  type DisabilityStatus,
  type AuditOpinion,
  type AuditSeverity,
  type DocumentType,
  type ReviewStatus,
  type ReportKind,
  type ReportStatus,
  type ExpenseCategory,
  type RequestCategory,
  type RequestStatus,
  type KpiAggregation,
  type Prisma,
} from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { ENTITY_SEEDS, type EntitySeed, type RiskProfile } from "../src/lib/seed-data/entities";
import { DEMO_USERS, DEMO_PASSWORD } from "../src/lib/seed-data/demo-users";
import { storage } from "../src/lib/storage";
import { recalculateAllRiskScores } from "../src/lib/risk-engine";
import { now } from "../src/lib/clock";
import { annualReportDueDate, quarterBounds, quarterlyReportDueDate, reportTitle } from "../src/lib/reporting-calendar";

const prisma = new PrismaClient();

faker.seed(2026);

const NOW = now();
const DAY_MS = 86_400_000;
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);
const round100 = (n: number) => Math.round(n / 100) * 100;

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

type KpiTemplate = { name: string; unit: string; programme: string };

const GENERIC_KPI_POOL: KpiTemplate[] = [
  { name: "Annual Performance Plan targets achieved", unit: "%", programme: "Governance" },
  { name: "Quarterly reports submitted on time", unit: "%", programme: "Compliance" },
  { name: "Governance meetings held", unit: "meetings", programme: "Governance" },
  { name: "Risk management reviews completed", unit: "reviews", programme: "Governance" },
  { name: "Vacancy rate maintained within target", unit: "%", programme: "Human Resources" },
  { name: "Employment equity targets met", unit: "%", programme: "Human Resources" },
  { name: "Supply chain management compliance", unit: "%", programme: "Compliance" },
  { name: "Stakeholder satisfaction score", unit: "score", programme: "Stakeholder Management" },
  { name: "Internal audit findings resolved", unit: "%", programme: "Governance" },
];

const SECTOR_KPI_POOL: Record<string, KpiTemplate[]> = {
  SPORT: [
    { name: "Athletes supported through high-performance programmes", unit: "athletes", programme: "Athlete Development" },
    { name: "Coaches accredited", unit: "coaches", programme: "Capacity Building" },
    { name: "School sport leagues completed", unit: "leagues", programme: "Participation" },
    { name: "National championships hosted", unit: "events", programme: "Events" },
    { name: "Anti-doping tests conducted", unit: "tests", programme: "Compliance" },
    { name: "Facilities upgraded", unit: "facilities", programme: "Infrastructure" },
    { name: "Talent identification camps held", unit: "camps", programme: "Athlete Development" },
    { name: "Participants reached in rural outreach", unit: "participants", programme: "Participation" },
  ],
  ARTS: [
    { name: "Productions staged", unit: "productions", programme: "Production" },
    { name: "Artists and practitioners funded", unit: "artists", programme: "Grant-making" },
    { name: "Public art commissions completed", unit: "commissions", programme: "Production" },
    { name: "Audience members reached", unit: "attendees", programme: "Audience Development" },
    { name: "Bursaries awarded", unit: "bursaries", programme: "Capacity Building" },
    { name: "Touring performances presented", unit: "performances", programme: "Production" },
  ],
  CULTURE: [
    { name: "Cultural festivals supported", unit: "festivals", programme: "Events" },
    { name: "Heritage days commemorated", unit: "events", programme: "Events" },
    { name: "Language development projects completed", unit: "projects", programme: "Language Development" },
    { name: "Community cultural programmes funded", unit: "programmes", programme: "Grant-making" },
  ],
  HERITAGE: [
    { name: "Heritage sites restored", unit: "sites", programme: "Conservation" },
    { name: "Heritage impact assessments completed", unit: "assessments", programme: "Compliance" },
    { name: "Memorials and monuments maintained", unit: "monuments", programme: "Conservation" },
    { name: "Custodian communities supported", unit: "communities", programme: "Community Support" },
  ],
  MUSEUMS: [
    { name: "Visitor numbers", unit: "visitors", programme: "Public Access" },
    { name: "Exhibitions held", unit: "exhibitions", programme: "Public Access" },
    { name: "Collection items digitised", unit: "items", programme: "Digitisation" },
    { name: "School education programmes delivered", unit: "programmes", programme: "Education" },
  ],
  LIBRARIES: [
    { name: "Libraries equipped or upgraded", unit: "libraries", programme: "Infrastructure" },
    { name: "Books and materials distributed", unit: "items", programme: "Access" },
    { name: "Digital literacy sessions run", unit: "sessions", programme: "Digital Inclusion" },
    { name: "Accessible-format titles produced", unit: "titles", programme: "Access" },
  ],
  ARCHIVES: [
    { name: "Archival records digitised", unit: "records", programme: "Digitisation" },
    { name: "Public access requests processed", unit: "requests", programme: "Public Access" },
    { name: "Records management audits completed", unit: "audits", programme: "Compliance" },
  ],
  OTHER: [],
};

const PROGRAMME_OBJECTIVES: Record<string, string> = {
  Governance: "Sound corporate governance and accountability",
  Compliance: "Full compliance with prescribed legislation and reporting duties",
  "Human Resources": "A capable, transformed and stable workforce",
  "Stakeholder Management": "Strong partnerships and stakeholder confidence",
  "Athlete Development": "Grow the pipeline of elite and emerging athletes",
  "Capacity Building": "Build the skills of practitioners and administrators",
  Participation: "Increase active participation, especially in under-served communities",
  Events: "Deliver high-impact national events",
  Infrastructure: "Provide accessible, well-maintained facilities",
  Production: "Sustain a vibrant national production output",
  "Grant-making": "Invest funding where it creates the most cultural value",
  "Audience Development": "Grow and diversify audiences",
  "Language Development": "Promote and develop the official languages",
  Conservation: "Protect and conserve the nation's heritage resources",
  "Community Support": "Empower custodian communities",
  "Public Access": "Open collections and services to the public",
  Digitisation: "Preserve and open up collections digitally",
  Education: "Use collections to educate learners",
  Access: "Widen access to reading and knowledge",
  "Digital Inclusion": "Close the digital divide",
};

const BIG_COUNT_UNITS = new Set(["athletes", "participants", "attendees", "visitors", "items", "records", "sessions", "requests", "titles"]);

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "EMPLOYEE_COSTS",
  "PROGRAMME_COSTS",
  "TRAVEL",
  "ADMINISTRATION",
  "PROFESSIONAL_FEES",
  "CAPITAL_EXPENDITURE",
  "OTHER",
];
const BASE_BUDGET_SHARE: Record<ExpenseCategory, number> = {
  EMPLOYEE_COSTS: 0.3,
  PROGRAMME_COSTS: 0.4,
  TRAVEL: 0.04,
  ADMINISTRATION: 0.1,
  PROFESSIONAL_FEES: 0.06,
  CAPITAL_EXPENDITURE: 0.07,
  OTHER: 0.03,
};

const QUARTERS: Extract<Quarter, "Q1" | "Q2" | "Q3" | "Q4">[] = ["Q1", "Q2", "Q3", "Q4"];
const KPI_PHASING = [0.15, 0.3, 0.3, 0.25]; // cumulative 15% / 45% / 75% / 100% of the annual target
const RATE_RAMP = [0.8, 0.88, 0.94, 1]; // share of the year-end target expected by each quarter, for rate KPIs
const SPEND_PHASING = [0.22, 0.26, 0.26, 0.26];

const FINANCIAL_YEARS = [
  { label: "2024/25", startDate: new Date("2024-04-01T00:00:00Z"), endDate: new Date("2025-03-31T00:00:00Z"), budgetFactor: 0.9 },
  { label: "2025/26", startDate: new Date("2025-04-01T00:00:00Z"), endDate: new Date("2026-03-31T00:00:00Z"), budgetFactor: 0.95 },
  { label: "2026/27", startDate: new Date("2026-04-01T00:00:00Z"), endDate: new Date("2027-03-31T00:00:00Z"), budgetFactor: 1 },
];

const PROVINCES = ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Limpopo", "Mpumalanga", "Free State", "North West", "Northern Cape"];

const RETURN_REASONS: Record<ReportKind, string[]> = {
  QUARTERLY_PERFORMANCE: [
    "Variance explanations required for underperforming targets.",
    "Missing supporting evidence for claimed achievements.",
    "Reported quarterly results do not reconcile with the evidence submitted.",
  ],
  QUARTERLY_FINANCIAL: [
    "Reported expenditure does not reconcile with the bank statements provided.",
    "Please explain the spend on Travel against the approved budget line.",
    "Supporting invoices are missing for Professional Fees.",
  ],
  GOVERNANCE_RETURN: ["Executive authority sign-off page is missing.", "Board meeting attendance register is incomplete."],
  ANNUAL_REPORT: ["The audited financial statements are not attached.", "Executive authority sign-off page is missing."],
};

const VARIANCE_REASONS = [
  "Delayed by a supply-chain procurement backlog.",
  "A vacancy in a key project role slowed delivery.",
  "The funding tranche was received later than planned.",
  "Stakeholder consultation took longer than scoped.",
  "Severe weather disrupted planned activities.",
];
const CORRECTIVE_ACTIONS = [
  "Fast-track procurement and appoint an implementing partner.",
  "Fill the vacant post and reallocate delivery to the regional team.",
  "Re-phase remaining activities into Q3 and Q4.",
  "Escalate to the accounting authority for a recovery plan.",
];

// ---------------------------------------------------------------------------
// Story controls: a few entities get a fixed narrative so the demo is repeatable.
// ---------------------------------------------------------------------------

type Outcome = "ON_TIME" | "LATE" | "RETURNED" | "RETURNED_THEN_FIXED" | "MISSING";
const FORCED_CURRENT_FY_OUTCOMES: Record<string, Partial<Record<string, Outcome>>> = {
  // Healthy entity: everything in on time.
  "national-sports-excellence-agency": { "QUARTERLY_PERFORMANCE|Q1": "ON_TIME", "QUARTERLY_FINANCIAL|Q1": "ON_TIME", "GOVERNANCE_RETURN|Q1": "ON_TIME" },
  // Critical entity: performance report returned, financial report and governance return never submitted.
  "frontier-history-museum-trust": { "QUARTERLY_PERFORMANCE|Q1": "RETURNED", "QUARTERLY_FINANCIAL|Q1": "MISSING", "GOVERNANCE_RETURN|Q1": "MISSING" },
  // Watch NPO: financial report returned, performance report submitted late.
  "youth-cultural-development-fund": { "QUARTERLY_PERFORMANCE|Q1": "LATE", "QUARTERLY_FINANCIAL|Q1": "RETURNED", "GOVERNANCE_RETURN|Q1": "ON_TIME" },
};

const PROFILE_PARAMS: Record<RiskProfile, { achievement: [number, number]; spendRate: [number, number]; outcomes: { value: Outcome; weight: number }[] }> = {
  healthy: {
    achievement: [0.94, 1.12],
    spendRate: [0.92, 1.0],
    outcomes: [
      { value: "ON_TIME", weight: 92 },
      { value: "LATE", weight: 8 },
    ],
  },
  watch: {
    achievement: [0.78, 1.0],
    spendRate: [0.76, 0.92],
    outcomes: [
      { value: "ON_TIME", weight: 55 },
      { value: "LATE", weight: 20 },
      { value: "RETURNED_THEN_FIXED", weight: 15 },
      { value: "RETURNED", weight: 10 },
    ],
  },
  critical: {
    achievement: [0.4, 0.9],
    spendRate: [0.5, 0.78],
    outcomes: [
      { value: "ON_TIME", weight: 15 },
      { value: "LATE", weight: 30 },
      { value: "RETURNED", weight: 20 },
      { value: "RETURNED_THEN_FIXED", weight: 10 },
      { value: "MISSING", weight: 25 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const uuid = () => crypto.randomUUID();
const between = (range: [number, number]) => faker.number.float({ min: range[0], max: range[1] });

function docBodyText(params: { title: string; entityName: string; typeLabel: string; fyLabel: string }) {
  return [
    params.title,
    `Entity: ${params.entityName}`,
    `Document type: ${params.typeLabel}`,
    `Financial year: ${params.fyLabel}`,
    "",
    "This is a synthetic placeholder document generated for the GovTech Hackathon 2026 demo of the",
    "DSAC Public Entity & NPO Reporting and Oversight Platform. In production this slot holds the entity's",
    "actual evidence (PDF, Word or Excel) rather than this plain-text stand-in.",
    "",
    "— Demo, synthetic data only.",
  ].join("\n");
}

async function uploadWithRetry(key: string, body: Buffer, contentType: string, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      await storage.upload(key, body, contentType);
      return;
    } catch (err) {
      if (i === attempts - 1) throw err;
      console.warn(`  storage upload retry (${i + 1}/${attempts}) for ${key}: ${(err as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

interface EvidenceDoc {
  entityId: string;
  entityName: string;
  type: DocumentType;
  title: string;
  fyLabel: string;
  authorId: string;
  createdAt: Date;
  reviewStatus: ReviewStatus;
  reviewerId?: string;
  reviewComment?: string;
  links?: { reportingPeriodId?: string; kpiId?: string; budgetLineId?: string; reportId?: string };
}

async function seedEvidenceDocument(doc: EvidenceDoc) {
  const document = await prisma.document.create({
    data: {
      entityId: doc.entityId,
      type: doc.type,
      title: doc.title,
      reportingPeriodId: doc.links?.reportingPeriodId,
      kpiId: doc.links?.kpiId,
      budgetLineId: doc.links?.budgetLineId,
      reportId: doc.links?.reportId,
      createdAt: doc.createdAt,
    },
  });
  const content = Buffer.from(docBodyText({ title: doc.title, entityName: doc.entityName, typeLabel: doc.type, fyLabel: doc.fyLabel }), "utf-8");
  const checksum = crypto.createHash("sha256").update(content).digest("hex");
  const storageKey = `entities/${doc.entityId}/documents/${document.id}/v1-${doc.type.toLowerCase()}.txt`;
  await uploadWithRetry(storageKey, content, "text/plain");
  await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: 1,
      storageKey,
      checksum,
      fileSize: content.byteLength,
      mimeType: "text/plain",
      authorId: doc.authorId,
      reviewStatus: doc.reviewStatus,
      reviewedById: doc.reviewerId,
      reviewedAt: doc.reviewerId ? addDays(doc.createdAt, 2) : undefined,
      reviewComment: doc.reviewComment,
      createdAt: doc.createdAt,
    },
  });
}

function budgetLinesFor(annualBudget: number): Record<ExpenseCategory, number> {
  const jittered = EXPENSE_CATEGORIES.map((c) => BASE_BUDGET_SHARE[c] * faker.number.float({ min: 0.8, max: 1.2 }));
  const total = jittered.reduce((a, b) => a + b, 0);
  const unit = annualBudget >= 100_000_000 ? 10_000 : 1_000;
  const amounts = {} as Record<ExpenseCategory, number>;
  let allocated = 0;
  EXPENSE_CATEGORIES.forEach((category, i) => {
    const isLast = i === EXPENSE_CATEGORIES.length - 1;
    const amount = isLast ? annualBudget - allocated : Math.round(((annualBudget * jittered[i]) / total) / unit) * unit;
    amounts[category] = amount;
    allocated += amount;
  });
  return amounts;
}

function pickOutcome(profile: RiskProfile, isPastFy: boolean): Outcome {
  const outcome = faker.helpers.weightedArrayElement(PROFILE_PARAMS[profile].outcomes);
  // A year on, an unresolved "returned" report or a still-missing one is rare and heavily
  // weighted towards being fixed; keep a small tail so history still shows some lapses.
  if (isPastFy && outcome === "RETURNED") return faker.number.float({ min: 0, max: 1 }) < 0.3 ? "RETURNED" : "RETURNED_THEN_FIXED";
  if (isPastFy && outcome === "MISSING") return faker.number.float({ min: 0, max: 1 }) < 0.3 ? "MISSING" : "LATE";
  return outcome;
}

function deliveredStatus(submittedAt: Date, isPastFy: boolean): ReportStatus {
  if (isPastFy) return "FINALISED";
  const age = daysBetween(submittedAt, NOW);
  if (age < 30) return faker.helpers.weightedArrayElement<ReportStatus>([{ value: "SUBMITTED", weight: 3 }, { value: "UNDER_REVIEW", weight: 4 }, { value: "ACCEPTED", weight: 3 }]);
  return faker.helpers.weightedArrayElement<ReportStatus>([{ value: "ACCEPTED", weight: 4 }, { value: "FINALISED", weight: 6 }]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding as of ${NOW.toISOString().slice(0, 10)}...`);
  console.log("Clearing existing data...");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.riskScore.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.workforceStat.deleteMany(),
    prisma.jobCreation.deleteMany(),
    prisma.auditFinding.deleteMany(),
    prisma.quarterlyExpenditure.deleteMany(),
    prisma.budgetLine.deleteMany(),
    prisma.disbursement.deleteMany(),
    prisma.performanceReport.deleteMany(),
    prisma.kpiMilestone.deleteMany(),
    prisma.kpi.deleteMany(),
    prisma.supportRequest.deleteMany(),
    prisma.report.deleteMany(),
    prisma.reportingPeriod.deleteMany(),
    prisma.financialYear.deleteMany(),
    prisma.user.deleteMany(),
    prisma.entity.deleteMany(),
  ]);

  // --- Financial years and the standard reporting calendar -----------------
  console.log("Creating financial years and reporting periods...");
  const fyRecords = new Map<string, { id: string; startDate: Date; endDate: Date; isPast: boolean; label: string; periods: Record<Quarter, { id: string; dueDate: Date }> }>();
  for (const fy of FINANCIAL_YEARS) {
    const created = await prisma.financialYear.create({ data: { label: fy.label, startDate: fy.startDate, endDate: fy.endDate } });
    const periods = {} as Record<Quarter, { id: string; dueDate: Date }>;
    for (const quarter of QUARTERS) {
      const { start, end } = quarterBounds(fy.startDate, quarter);
      const dueDate = quarterlyReportDueDate("QUARTERLY_PERFORMANCE", fy.startDate, quarter);
      const period = await prisma.reportingPeriod.create({ data: { financialYearId: created.id, quarter, startDate: start, endDate: end, dueDate } });
      periods[quarter] = { id: period.id, dueDate };
    }
    const annualDue = annualReportDueDate(fy.endDate);
    const annual = await prisma.reportingPeriod.create({ data: { financialYearId: created.id, quarter: "ANNUAL", startDate: fy.startDate, endDate: fy.endDate, dueDate: annualDue } });
    periods.ANNUAL = { id: annual.id, dueDate: annualDue };
    fyRecords.set(fy.label, { id: created.id, startDate: fy.startDate, endDate: fy.endDate, isPast: fy.endDate < NOW, label: fy.label, periods });
  }
  const currentFyLabel = FINANCIAL_YEARS.find((fy) => fy.startDate <= NOW && NOW <= addDays(fy.endDate, 1))?.label ?? FINANCIAL_YEARS.at(-1)!.label;

  // --- Entities (with organisational profile) ------------------------------
  console.log("Creating entities...");
  const entityRecords = new Map<string, { id: string; seed: EntitySeed }>();
  for (const seed of ENTITY_SEEDS) {
    const domain = `${seed.slug.replace(/-/g, "")}.demo.org`;
    const isNpo = seed.type === "NPO";
    const entity = await prisma.entity.create({
      data: {
        name: seed.name,
        type: seed.type,
        sector: seed.sector,
        description: seed.description,
        registrationNumber: isNpo ? `${faker.number.int({ min: 100, max: 999 })}-${faker.number.int({ min: 100, max: 999 })} NPO` : `PE/${faker.number.int({ min: 1994, max: 2016 })}/${faker.number.int({ min: 1, max: 99 }).toString().padStart(4, "0")}`,
        establishedYear: faker.number.int({ min: 1994, max: 2018 }),
        province: faker.helpers.arrayElement(PROVINCES),
        physicalAddress: `${faker.location.streetAddress()}, ${faker.location.city()}`,
        contactPerson: faker.person.fullName(),
        contactEmail: `info@${domain}`,
        contactPhone: `+27 ${faker.number.int({ min: 10, max: 21 })} 555 ${faker.number.int({ min: 100, max: 999 }).toString().padStart(4, "0")}`.slice(0, 20),
        website: `https://www.${domain}`,
        accountingAuthority: isNpo ? "Chairperson of the Board of Trustees" : "Chief Executive Officer (Accounting Authority)",
        mandate: `${seed.description} Funded and overseen by the Department of Sport, Arts and Culture.`,
      },
    });
    entityRecords.set(seed.slug, { id: entity.id, seed });
  }

  // --- Users ------------------------------------------------------------------
  console.log("Creating users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const usersByEntity = new Map<string, string[]>();
  const dsacReviewerIds: string[] = [];
  for (const demoUser of DEMO_USERS) {
    const entityId = demoUser.entitySlug ? entityRecords.get(demoUser.entitySlug)?.id : undefined;
    const user = await prisma.user.create({
      data: { name: demoUser.name, email: demoUser.email, hashedPassword: passwordHash, role: demoUser.role, entityId, isDemoUser: true },
    });
    if (entityId) usersByEntity.set(entityId, [...(usersByEntity.get(entityId) ?? []), user.id]);
    if (demoUser.role === "DSAC_ADMIN" || demoUser.role === "DSAC_ANALYST") dsacReviewerIds.push(user.id);
  }
  for (const [slug, { id: entityId }] of entityRecords) {
    if ((usersByEntity.get(entityId) ?? []).length >= 2) continue;
    const domain = `${slug.replace(/-/g, "")}.demo.org`;
    const admin = await prisma.user.create({
      data: { name: faker.person.fullName(), email: `admin.${slug}@${domain}`.slice(0, 254), hashedPassword: passwordHash, role: "ENTITY_ADMIN", entityId, isDemoUser: true },
    });
    const contributor = await prisma.user.create({
      data: { name: faker.person.fullName(), email: `contributor.${slug}@${domain}`.slice(0, 254), hashedPassword: passwordHash, role: "ENTITY_CONTRIBUTOR", entityId, isDemoUser: true },
    });
    usersByEntity.set(entityId, [...(usersByEntity.get(entityId) ?? []), admin.id, contributor.id]);
  }

  // --- Per-entity: KPIs, finance, reports, evidence -------------------------
  console.log("Creating KPIs, budgets, disbursements, expenditure, reports and evidence...");
  const notificationRows: Prisma.NotificationCreateManyInput[] = [];
  const entityUsers = await prisma.user.findMany({ select: { id: true, entityId: true, role: true } });

  for (const { id: entityId, seed } of entityRecords.values()) {
    const profile = seed.riskProfile;
    const params = PROFILE_PARAMS[profile];
    const authorIds = usersByEntity.get(entityId) ?? [];
    const author = () => faker.helpers.arrayElement(authorIds);
    const reviewer = () => faker.helpers.arrayElement(dsacReviewerIds);

    const pool = [...faker.helpers.shuffle(GENERIC_KPI_POOL).slice(0, faker.number.int({ min: 3, max: 4 })), ...faker.helpers.shuffle(SECTOR_KPI_POOL[seed.sector] ?? []).slice(0, faker.number.int({ min: 3, max: 5 }))];
    // Per-KPI target scale and delivery quality stay the same across years so the year-on-year story is coherent.
    const kpiPlans = pool.map((template) => {
      const isRate = template.unit === "%" || template.unit === "score";
      const annualTarget = isRate
        ? template.unit === "%" ? faker.number.int({ min: 85, max: 100 }) : faker.number.int({ min: 70, max: 90 })
        : BIG_COUNT_UNITS.has(template.unit) ? round100(faker.number.int({ min: 1500, max: 25000 })) : faker.number.int({ min: 8, max: 120 });
      return { template, isRate, aggregation: (isRate ? "LATEST" : "SUM") as KpiAggregation, baseTarget: annualTarget, quality: between(params.achievement) };
    });

    // Financial years, oldest first.
    for (const fy of FINANCIAL_YEARS) {
      const fyRec = fyRecords.get(fy.label)!;
      const isCurrent = fy.label === currentFyLabel;
      const isPast = fyRec.isPast;
      const annualBudget = round100(seed.annualBudget * fy.budgetFactor);

      // ---- Budget lines ----
      const lineAmounts = budgetLinesFor(annualBudget);
      const budgetLines = EXPENSE_CATEGORIES.map((category) => ({ id: uuid(), category, annualBudget: lineAmounts[category] }));
      await prisma.budgetLine.createMany({ data: budgetLines.map((l) => ({ id: l.id, entityId, financialYearId: fyRec.id, category: l.category, annualBudget: l.annualBudget })) });

      // ---- Disbursements (25% tranches at the start of each quarter) ----
      const trancheAmount = round100(annualBudget * 0.25);
      const disbursements: { tranche: number; amount: number; at: Date }[] = [];
      for (let t = 0; t < 4; t++) {
        const at = new Date(Date.UTC(fy.startDate.getUTCFullYear(), fy.startDate.getUTCMonth() + t * 3, 1));
        if (at > NOW) continue;
        if (isCurrent && profile === "critical" && t === 1) continue; // DSAC is holding the second tranche back
        disbursements.push({ tranche: t + 1, amount: t === 3 ? annualBudget - trancheAmount * 3 : trancheAmount, at });
      }
      await prisma.disbursement.createMany({ data: disbursements.map((d) => ({ entityId, financialYearId: fyRec.id, trancheNumber: d.tranche, amount: d.amount, disbursedAt: d.at })) });

      // ---- KPIs, milestones ----
      const growth = 1 + (FINANCIAL_YEARS.indexOf(fy) - 1) * 0.04;
      const kpis = kpiPlans.map((plan) => {
        const annualTarget = plan.isRate ? Math.min(100, Math.round(plan.baseTarget * (plan.template.unit === "%" ? 1 : growth))) : Math.max(4, Math.round(plan.baseTarget * growth));
        const quarterTargets = plan.isRate
          ? RATE_RAMP.map((ramp) => Math.round(annualTarget * ramp * 10) / 10)
          : (() => {
              const first = KPI_PHASING.slice(0, 3).map((p) => Math.round(annualTarget * p));
              return [...first, annualTarget - first.reduce((a, b) => a + b, 0)];
            })();
        // Delivery quality drifts a little from year to year, so trends aren't flat.
        return { id: uuid(), plan, annualTarget, quarterTargets, quality: plan.quality * faker.number.float({ min: 0.93, max: 1.07 }) };
      });
      await prisma.kpi.createMany({
        data: kpis.map((k) => ({
          id: k.id,
          entityId,
          financialYearId: fyRec.id,
          programme: k.plan.template.programme,
          objective: PROGRAMME_OBJECTIVES[k.plan.template.programme] ?? `Deliver on the ${k.plan.template.programme} mandate`,
          name: k.plan.template.name,
          unit: k.plan.template.unit,
          aggregation: k.plan.aggregation,
          annualTarget: k.annualTarget,
        })),
      });
      await prisma.kpiMilestone.createMany({
        data: kpis.flatMap((k) => QUARTERS.map((q, i) => ({ kpiId: k.id, reportingPeriodId: fyRec.periods[q].id, targetValue: k.quarterTargets[i] }))),
      });

      // ---- Reports (one row per required submission) + the data behind them ----
      const forced = isCurrent ? FORCED_CURRENT_FY_OUTCOMES[seed.slug] ?? {} : {};
      const reportRows: Prisma.ReportCreateManyInput[] = [];
      const perfRows: Prisma.PerformanceReportCreateManyInput[] = [];
      const expenditureRows: Prisma.QuarterlyExpenditureCreateManyInput[] = [];
      const reportIdsByKey = new Map<string, { id: string; status: ReportStatus; reviewComment?: string; submittedAt: Date | null; reviewedAt: Date | null }>();

      // Spend behaviour is set once per year so the run-rate is consistent across quarters.
      const spendRate = between(params.spendRate);
      const overspendCategory: ExpenseCategory | null = !isCurrent && profile !== "healthy" && faker.number.float({ min: 0, max: 1 }) < (profile === "critical" ? 0.6 : 0.3) ? "TRAVEL" : null;
      const lineFactor = new Map(budgetLines.map((l) => [l.category, l.category === overspendCategory ? faker.number.float({ min: 1.1, max: 1.25 }) : faker.number.float({ min: 0.85, max: 1.12 })]));

      const requiredReports: { kind: ReportKind; quarter: Quarter }[] = [
        ...QUARTERS.flatMap((quarter) => (["QUARTERLY_PERFORMANCE", "QUARTERLY_FINANCIAL", "GOVERNANCE_RETURN"] as ReportKind[]).map((kind) => ({ kind, quarter }))),
        { kind: "ANNUAL_REPORT" as ReportKind, quarter: "ANNUAL" as Quarter },
      ];

      for (const { kind, quarter } of requiredReports) {
        const period = fyRec.periods[quarter];
        const dueDate = kind === "ANNUAL_REPORT" ? annualReportDueDate(fy.endDate) : quarterlyReportDueDate(kind, fy.startDate, quarter as (typeof QUARTERS)[number]);
        const title = reportTitle(kind, fy.label, quarter === "ANNUAL" ? undefined : (quarter as (typeof QUARTERS)[number]));
        const reportId = uuid();
        const daysSinceDue = daysBetween(dueDate, NOW);
        const pastDue = daysSinceDue > 0;

        let status: ReportStatus = "DRAFT";
        let submittedAt: Date | null = null;
        let reviewedAt: Date | null = null;
        let finalisedAt: Date | null = null;
        let reviewComment: string | undefined;
        let reviewedById: string | undefined;

        if (pastDue) {
          let outcome: Outcome = forced[`${kind}|${quarter}`] ?? pickOutcome(profile, isPast);
          if (outcome === "LATE" && daysSinceDue <= 3) outcome = "ON_TIME";
          if (outcome !== "MISSING") {
            const late = outcome === "LATE" || (outcome === "RETURNED_THEN_FIXED" && faker.number.float({ min: 0, max: 1 }) < 0.5);
            const lateDays = late ? Math.min(faker.number.int({ min: 2, max: 25 }), Math.max(1, daysSinceDue - 1)) : -faker.number.int({ min: 1, max: 12 });
            submittedAt = addDays(dueDate, lateDays);
            if (submittedAt > addDays(NOW, -1)) submittedAt = addDays(NOW, -1);
            const reviewAt = new Date(Math.min(addDays(submittedAt, faker.number.int({ min: 3, max: 10 })).getTime(), addDays(NOW, -1).getTime()));

            if (outcome === "RETURNED") {
              status = "RETURNED";
              reviewedAt = reviewAt;
              reviewedById = reviewer();
              reviewComment = faker.helpers.arrayElement(RETURN_REASONS[kind]);
            } else {
              status = deliveredStatus(submittedAt, isPast);
              if (status !== "SUBMITTED") reviewedById = reviewer();
              if (status !== "SUBMITTED") reviewedAt = reviewAt;
              if (status === "FINALISED") finalisedAt = new Date(Math.min(addDays(reviewAt, faker.number.int({ min: 2, max: 7 })).getTime(), addDays(NOW, -1).getTime()));
              if (outcome === "RETURNED_THEN_FIXED") reviewComment = "Returned once for correction; resubmission accepted.";
            }
          }
        }
        reportRows.push({
          id: reportId,
          entityId,
          financialYearId: fyRec.id,
          reportingPeriodId: period.id,
          kind,
          title,
          dueDate,
          status,
          submittedAt,
          submittedById: submittedAt ? author() : null,
          reviewedAt,
          reviewedById: reviewedById ?? null,
          reviewComment: reviewComment ?? null,
          finalisedAt,
        });
        reportIdsByKey.set(`${kind}|${quarter}`, { id: reportId, status, reviewComment, submittedAt, reviewedAt });

        // Structured data exists once the entity has captured it (i.e. the report has left DRAFT).
        if (status !== "DRAFT" && submittedAt) {
          if (kind === "QUARTERLY_PERFORMANCE") {
            const qIndex = QUARTERS.indexOf(quarter as (typeof QUARTERS)[number]);
            for (const k of kpis) {
              const target = k.quarterTargets[qIndex];
              const noise = faker.number.float({ min: 0.95, max: 1.05 });
              const raw = target * k.quality * noise;
              const actual = k.plan.isRate ? Math.min(100, Math.round(raw * 10) / 10) : Math.max(0, Math.round(raw));
              const behind = actual < target * 0.85;
              perfRows.push({
                kpiId: k.id,
                reportingPeriodId: period.id,
                actualValue: actual,
                varianceExplanation: behind ? faker.helpers.arrayElement(VARIANCE_REASONS) : null,
                correctiveAction: behind ? faker.helpers.arrayElement(CORRECTIVE_ACTIONS) : null,
                submittedById: author(),
                submittedAt,
              });
            }
          }
          if (kind === "QUARTERLY_FINANCIAL") {
            const qIndex = QUARTERS.indexOf(quarter as (typeof QUARTERS)[number]);
            for (const line of budgetLines) {
              const amount = Math.max(0, round100(line.annualBudget * spendRate * SPEND_PHASING[qIndex] * (lineFactor.get(line.category) ?? 1) * faker.number.float({ min: 0.93, max: 1.07 })));
              expenditureRows.push({ budgetLineId: line.id, quarter: quarter as Quarter, amount, recordedAt: submittedAt });
            }
          }
        }
      }

      await prisma.report.createMany({ data: reportRows });
      if (perfRows.length) await prisma.performanceReport.createMany({ data: perfRows });
      if (expenditureRows.length) await prisma.quarterlyExpenditure.createMany({ data: expenditureRows });

      // ---- Notifications for reports DSAC has returned ----
      for (const row of reportRows) {
        if (row.status !== "RETURNED" || !isCurrent) continue;
        for (const user of entityUsers.filter((u) => u.entityId === entityId && (u.role === "ENTITY_ADMIN" || u.role === "ENTITY_CONTRIBUTOR"))) {
          notificationRows.push({
            userId: user.id,
            entityId,
            channel: "IN_APP",
            type: "REVIEW_RETURNED",
            title: `DSAC has returned your report for correction: ${row.title}`,
            body: row.reviewComment ?? "Please review DSAC's comments and resubmit.",
            link: "/reports",
            createdAt: row.reviewedAt ?? NOW,
          });
        }
      }

      // ---- Evidence documents ----
      const evidenceFor = (kind: ReportKind, quarter: Quarter) => reportIdsByKey.get(`${kind}|${quarter}`);
      const docStatusFor = (report: { status: ReportStatus; reviewComment?: string }): { reviewStatus: ReviewStatus; comment?: string } =>
        report.status === "RETURNED" ? { reviewStatus: "RETURNED", comment: report.reviewComment } : report.status === "ACCEPTED" || report.status === "FINALISED" ? { reviewStatus: "APPROVED" } : report.status === "UNDER_REVIEW" ? { reviewStatus: "UNDER_REVIEW" } : { reviewStatus: "RECEIVED" };

      // Quarter whose evidence we attach: the latest quarter that has been reported in this year.
      const latestReportedQuarter = [...QUARTERS].reverse().find((q) => {
        const r = evidenceFor("QUARTERLY_PERFORMANCE", q);
        return r && r.status !== "DRAFT";
      });
      if (latestReportedQuarter && (isCurrent || fy.label === FINANCIAL_YEARS.at(-2)!.label)) {
        const perf = evidenceFor("QUARTERLY_PERFORMANCE", latestReportedQuarter)!;
        const fin = evidenceFor("QUARTERLY_FINANCIAL", latestReportedQuarter);
        const perfDoc = docStatusFor(perf);
        await seedEvidenceDocument({
          entityId, entityName: seed.name, type: "QUARTERLY_REPORT", fyLabel: fy.label, authorId: author(),
          title: `${latestReportedQuarter} FY ${fy.label} — programme delivery evidence pack`,
          createdAt: perf.submittedAt ?? NOW, reviewStatus: perfDoc.reviewStatus, reviewComment: perfDoc.comment, reviewerId: perfDoc.reviewStatus === "RECEIVED" ? undefined : reviewer(),
          links: { reportId: perf.id, reportingPeriodId: fyRec.periods[latestReportedQuarter].id },
        });
        // Evidence tied to one specific KPI, so the Performance tab's Evidence column has something to show.
        const evidenceKpi = kpis.find((k) => !k.plan.isRate) ?? kpis[0];
        await seedEvidenceDocument({
          entityId, entityName: seed.name, type: "OTHER", fyLabel: fy.label, authorId: author(),
          title: `${evidenceKpi.plan.template.name} — attendance registers and delivery records`,
          createdAt: perf.submittedAt ?? NOW, reviewStatus: perfDoc.reviewStatus === "RETURNED" ? "RECEIVED" : perfDoc.reviewStatus,
          reviewerId: perfDoc.reviewStatus === "APPROVED" ? reviewer() : undefined,
          links: { kpiId: evidenceKpi.id, reportId: perf.id, reportingPeriodId: fyRec.periods[latestReportedQuarter].id },
        });
        if (fin && fin.status !== "DRAFT") {
          const finDoc = docStatusFor(fin);
          await seedEvidenceDocument({
            entityId, entityName: seed.name, type: "FINANCIALS", fyLabel: fy.label, authorId: author(),
            title: `${latestReportedQuarter} FY ${fy.label} — invoices and bank reconciliation`,
            createdAt: fin.submittedAt ?? NOW, reviewStatus: finDoc.reviewStatus, reviewComment: finDoc.comment, reviewerId: finDoc.reviewStatus === "RECEIVED" ? undefined : reviewer(),
            links: { reportId: fin.id, budgetLineId: budgetLines.find((l) => l.category === "PROGRAMME_COSTS")?.id, reportingPeriodId: fyRec.periods[latestReportedQuarter].id },
          });
        }
      }
      const annual = evidenceFor("ANNUAL_REPORT", "ANNUAL");
      if (annual && annual.status !== "DRAFT") {
        const annualDoc = docStatusFor(annual);
        await seedEvidenceDocument({
          entityId, entityName: seed.name, type: "ANNUAL_REPORT", fyLabel: fy.label, authorId: author(),
          title: `Annual Report FY ${fy.label}`, createdAt: annual.submittedAt ?? NOW,
          reviewStatus: annualDoc.reviewStatus, reviewComment: annualDoc.comment, reviewerId: annualDoc.reviewStatus === "RECEIVED" ? undefined : reviewer(),
          links: { reportId: annual.id, reportingPeriodId: fyRec.periods.ANNUAL.id },
        });
      }
      if (fy.label === FINANCIAL_YEARS[0].label) {
        await seedEvidenceDocument({
          entityId, entityName: seed.name, type: "STRATEGIC_PLAN", fyLabel: fy.label, authorId: author(),
          title: `${seed.name} Strategic Plan 2024–2029`, createdAt: fy.startDate, reviewStatus: "APPROVED", reviewerId: reviewer(),
        });
      }
      await seedEvidenceDocument({
        entityId, entityName: seed.name, type: "APP", fyLabel: fy.label, authorId: author(),
        title: `Annual Performance Plan FY ${fy.label}`, createdAt: fy.startDate, reviewStatus: "APPROVED", reviewerId: reviewer(),
        links: { reportingPeriodId: fyRec.periods.ANNUAL.id },
      });

      // ---- Audit findings (completed years only) ----
      if (isPast) {
        const findingCount = profile === "healthy" ? faker.number.int({ min: 0, max: 1 }) : profile === "watch" ? faker.number.int({ min: 1, max: 2 }) : faker.number.int({ min: 2, max: 3 });
        const opinion: AuditOpinion =
          profile === "healthy" ? faker.helpers.arrayElement<AuditOpinion>(["CLEAN", "CLEAN", "UNQUALIFIED_WITH_FINDINGS"]) : profile === "watch" ? faker.helpers.arrayElement<AuditOpinion>(["UNQUALIFIED_WITH_FINDINGS", "QUALIFIED"]) : faker.helpers.arrayElement<AuditOpinion>(["QUALIFIED", "ADVERSE", "DISCLAIMER"]);
        for (let i = 0; i < findingCount; i++) {
          const severity: AuditSeverity = profile === "healthy" ? "LOW" : profile === "watch" ? faker.helpers.arrayElement<AuditSeverity>(["LOW", "MEDIUM"]) : faker.helpers.arrayElement<AuditSeverity>(["MEDIUM", "HIGH", "CRITICAL"]);
          const isResolved = profile === "healthy" || faker.number.float({ min: 0, max: 1 }) > 0.6;
          await prisma.auditFinding.create({
            data: {
              entityId, financialYearId: fyRec.id,
              category: faker.helpers.arrayElement(["Supply chain management", "Predetermined objectives", "Financial statements", "Compliance with laws and regulations", "IT governance"]),
              severity, status: isResolved ? "RESOLVED" : faker.helpers.arrayElement(["OPEN", "IN_PROGRESS"]), auditorOpinion: opinion,
              description: faker.helpers.arrayElement([
                "Material misstatement identified in reported performance information.",
                "Inadequate supporting documentation for reported achievements.",
                "Non-compliance with supply chain management prescripts.",
                "Weaknesses identified in IT general controls.",
                "Irregular expenditure not adequately investigated.",
              ]),
              resolvedAt: isResolved ? fy.endDate : null,
            },
          });
        }
      }

      // ---- Workforce (aggregated) and jobs created ----
      const genders: Gender[] = ["FEMALE", "MALE", "OTHER"];
      const races: RaceCategory[] = ["AFRICAN", "COLOURED", "INDIAN", "WHITE", "OTHER"];
      const ageBands: AgeBand[] = ["UNDER_25", "AGE_25_34", "AGE_35_44", "AGE_45_54", "AGE_55_PLUS"];
      const disabilityStatuses: DisabilityStatus[] = ["WITHOUT_DISABILITY", "WITH_DISABILITY"];
      const combos = new Set<string>();
      const comboCount = faker.number.int({ min: 12, max: 18 });
      let attempts = 0;
      while (combos.size < comboCount && attempts < comboCount * 5) {
        attempts++;
        const disability = faker.helpers.weightedArrayElement([{ value: disabilityStatuses[0], weight: 9 }, { value: disabilityStatuses[1], weight: 1 }]);
        combos.add(`${faker.helpers.arrayElement(genders)}|${faker.helpers.arrayElement(races)}|${faker.helpers.arrayElement(ageBands)}|${disability}`);
      }
      await prisma.workforceStat.createMany({
        data: [...combos].map((combo) => {
          const [gender, raceCategory, ageBand, disabilityStatus] = combo.split("|") as [Gender, RaceCategory, AgeBand, DisabilityStatus];
          return { entityId, financialYearId: fyRec.id, gender, raceCategory, ageBand, disabilityStatus, headcount: faker.number.int({ min: 1, max: 35 }) };
        }),
      });
      const jobScale = annualBudget / 50_000_000;
      const jobMultiplier = profile === "healthy" ? 1 : profile === "watch" ? 0.7 : 0.4;
      await prisma.jobCreation.createMany({
        data: [
          { entityId, financialYearId: fyRec.id, jobType: "PERMANENT", count: Math.max(1, Math.round(jobScale * 4 * jobMultiplier)) },
          { entityId, financialYearId: fyRec.id, jobType: "TEMPORARY", count: Math.max(1, Math.round(jobScale * 12 * jobMultiplier)) },
          { entityId, financialYearId: fyRec.id, jobType: "YOUTH", count: Math.max(1, Math.round(jobScale * 8 * jobMultiplier)) },
        ],
      });
    }
  }
  if (notificationRows.length) await prisma.notification.createMany({ data: notificationRows });

  // --- Support requests -----------------------------------------------------
  console.log("Creating support requests...");
  const REQUEST_TEMPLATES: { title: string; category: RequestCategory; amount?: [number, number]; motivation: string; outcome: string }[] = [
    { title: "Additional funding for facility repairs", category: "ADDITIONAL_FUNDING", amount: [400_000, 2_500_000], motivation: "Storm damage to the main venue exceeds what the approved maintenance line can absorb.", outcome: "Venue reopened to the public within one quarter." },
    { title: "Mid-year budget adjustment for programme delivery", category: "BUDGET_REQUEST", amount: [250_000, 1_800_000], motivation: "Demand for funded programmes is above plan and current allocations will be exhausted by Q3.", outcome: "Programme targets for the year met in full." },
    { title: "Technical support: performance-information systems", category: "TECHNICAL_SUPPORT", motivation: "We need help configuring a reliable process for capturing and evidencing quarterly KPI data.", outcome: "Audit-ready performance information from the next quarter." },
    { title: "Governance assistance: board induction and policy review", category: "GOVERNANCE_ASSISTANCE", motivation: "Three new board members have been appointed and several policies are overdue for review.", outcome: "Updated governance framework approved by the board." },
    { title: "Programme support for rural outreach", category: "PROGRAMME_SUPPORT", motivation: "Logistics and travel costs for rural delivery exceed our current capacity.", outcome: "Outreach expanded to additional districts." },
    { title: "Capacity-building: financial management training", category: "CAPACITY_BUILDING", motivation: "Finance staff need training on the standard reporting templates and PFMA requirements.", outcome: "All finance staff certified and reporting errors reduced." },
  ];
  const REQUEST_STATUS_WEIGHTS: { value: RequestStatus; weight: number }[] = [
    { value: "SUBMITTED", weight: 3 }, { value: "UNDER_REVIEW", weight: 3 }, { value: "APPROVED", weight: 2 },
    { value: "DECLINED", weight: 1 }, { value: "MORE_INFO_REQUIRED", weight: 1 }, { value: "COMPLETED", weight: 2 },
  ];
  const currentFy = fyRecords.get(currentFyLabel)!;
  for (const { id: entityId, seed } of entityRecords.values()) {
    const authorIds = usersByEntity.get(entityId) ?? [];
    const count = seed.slug === "frontier-history-museum-trust" ? 2 : faker.helpers.weightedArrayElement([{ value: 0, weight: 3 }, { value: 1, weight: 4 }, { value: 2, weight: 2 }, { value: 3, weight: 1 }]);
    const programmes = await prisma.kpi.findMany({ where: { entityId, financialYearId: currentFy.id }, select: { programme: true }, distinct: ["programme"] });
    for (const template of faker.helpers.shuffle(REQUEST_TEMPLATES).slice(0, count)) {
      const status = faker.helpers.weightedArrayElement(REQUEST_STATUS_WEIGHTS);
      const decided = status !== "SUBMITTED" && status !== "UNDER_REVIEW";
      const createdAt = addDays(NOW, -faker.number.int({ min: 3, max: 60 }));
      await prisma.supportRequest.create({
        data: {
          entityId, financialYearId: currentFy.id, title: template.title, category: template.category,
          amountRequested: template.amount ? round100(faker.number.int({ min: template.amount[0], max: Math.max(template.amount[0], Math.min(template.amount[1], seed.annualBudget * 0.05)) })) : null,
          motivation: template.motivation, expectedOutcome: template.outcome,
          linkedProgramme: programmes.length ? faker.helpers.arrayElement(programmes).programme : null,
          status, createdById: faker.helpers.arrayElement(authorIds), createdAt,
          decidedById: decided ? faker.helpers.arrayElement(dsacReviewerIds) : null,
          decidedAt: decided ? addDays(createdAt, faker.number.int({ min: 2, max: 14 })) : null,
          decisionNote: status === "DECLINED" ? "Not affordable within the current allocation; please resubmit for the next budget cycle." : status === "MORE_INFO_REQUIRED" ? "Please provide quotations and a breakdown of the amount requested." : status === "APPROVED" || status === "COMPLETED" ? "Approved — funds and support will be arranged with your finance team." : null,
        },
      });
    }
  }

  // --- Tasks and comments (parked features; kept so the data stays valid) ---
  console.log("Creating tasks and comments...");
  for (const { id: entityId } of entityRecords.values()) {
    const entityUserIds = usersByEntity.get(entityId) ?? [];
    if (entityUserIds.length === 0) continue;
    await prisma.task.create({
      data: {
        entityId, title: "Resubmit returned quarterly report", assigneeId: faker.helpers.arrayElement(entityUserIds), assignerId: faker.helpers.arrayElement(dsacReviewerIds),
        direction: "FROM_DSAC", status: "TODO", dueDate: addDays(NOW, faker.number.int({ min: 5, max: 30 })),
      },
    });
  }

  console.log("Computing initial risk scores (weighted model + trained logistic regression)...");
  const riskScoreCount = await recalculateAllRiskScores();

  const [reports, kpis, lines, expenditures] = await Promise.all([prisma.report.count(), prisma.kpi.count(), prisma.budgetLine.count(), prisma.quarterlyExpenditure.count()]);
  console.log(
    `Seed complete: ${ENTITY_SEEDS.length} entities, ${DEMO_USERS.length} demo users (+ auto-generated), ${kpis} KPIs, ${lines} budget lines, ${expenditures} expenditure entries, ${reports} reports, ${riskScoreCount} risk scores.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
