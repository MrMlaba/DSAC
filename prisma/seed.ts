import crypto from "node:crypto";
import {
  PrismaClient,
  type Quarter,
  type KpiStatus,
  type Gender,
  type RaceCategory,
  type AgeBand,
  type DisabilityStatus,
  type AuditOpinion,
  type AuditSeverity,
  type DocumentType,
  type ReviewStatus,
} from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { ENTITY_SEEDS, type EntitySector, type RiskProfile } from "../src/lib/seed-data/entities";
import { DEMO_USERS, DEMO_PASSWORD } from "../src/lib/seed-data/demo-users";
import { storage } from "../src/lib/storage";
import { recalculateAllRiskScores } from "../src/lib/risk-engine";

const prisma = new PrismaClient();

faker.seed(2026);

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const GENERIC_KPI_POOL = [
  { name: "Annual Performance Plan targets achieved", unit: "%", category: "Governance" },
  { name: "Quarterly reports submitted on time", unit: "%", category: "Compliance" },
  { name: "Governance meetings held", unit: "meetings", category: "Governance" },
  { name: "Risk management reviews completed", unit: "reviews", category: "Governance" },
  { name: "Vacancy rate maintained within target", unit: "%", category: "Human Resources" },
  { name: "Employment equity targets met", unit: "%", category: "Human Resources" },
  { name: "Supply chain management compliance", unit: "%", category: "Compliance" },
  { name: "Stakeholder satisfaction score", unit: "score", category: "Stakeholder Management" },
  { name: "Internal audit findings resolved", unit: "%", category: "Governance" },
];

const SECTOR_KPI_POOL: Record<EntitySector, { name: string; unit: string; category: string }[]> = {
  SPORT: [
    { name: "Athletes supported through high-performance programmes", unit: "athletes", category: "Athlete Development" },
    { name: "Coaches accredited", unit: "coaches", category: "Capacity Building" },
    { name: "School sport leagues completed", unit: "leagues", category: "Participation" },
    { name: "National championships hosted", unit: "events", category: "Events" },
    { name: "Anti-doping tests conducted", unit: "tests", category: "Compliance" },
    { name: "Facilities upgraded", unit: "facilities", category: "Infrastructure" },
    { name: "Talent identification camps held", unit: "camps", category: "Athlete Development" },
    { name: "Participants reached in rural outreach", unit: "participants", category: "Participation" },
  ],
  ARTS: [
    { name: "Productions staged", unit: "productions", category: "Production" },
    { name: "Artists and practitioners funded", unit: "artists", category: "Grant-making" },
    { name: "Public art commissions completed", unit: "commissions", category: "Production" },
    { name: "Audience members reached", unit: "attendees", category: "Audience Development" },
    { name: "Bursaries awarded", unit: "bursaries", category: "Capacity Building" },
    { name: "Touring performances presented", unit: "performances", category: "Production" },
  ],
  CULTURE: [
    { name: "Cultural festivals supported", unit: "festivals", category: "Events" },
    { name: "Heritage days commemorated", unit: "events", category: "Events" },
    { name: "Language development projects completed", unit: "projects", category: "Language Development" },
    { name: "Community cultural programmes funded", unit: "programmes", category: "Grant-making" },
  ],
  HERITAGE: [
    { name: "Heritage sites restored", unit: "sites", category: "Conservation" },
    { name: "Heritage impact assessments completed", unit: "assessments", category: "Compliance" },
    { name: "Memorials and monuments maintained", unit: "monuments", category: "Conservation" },
    { name: "Custodian communities supported", unit: "communities", category: "Community Support" },
  ],
  MUSEUMS: [
    { name: "Visitor numbers", unit: "visitors", category: "Public Access" },
    { name: "Exhibitions held", unit: "exhibitions", category: "Public Access" },
    { name: "Collection items digitised", unit: "items", category: "Digitisation" },
    { name: "School education programmes delivered", unit: "programmes", category: "Education" },
  ],
  LIBRARIES: [
    { name: "Libraries equipped or upgraded", unit: "libraries", category: "Infrastructure" },
    { name: "Books and materials distributed", unit: "items", category: "Access" },
    { name: "Digital literacy sessions run", unit: "sessions", category: "Digital Inclusion" },
    { name: "Accessible-format titles produced", unit: "titles", category: "Access" },
  ],
  ARCHIVES: [
    { name: "Archival records digitised", unit: "records", category: "Digitisation" },
    { name: "Public access requests processed", unit: "requests", category: "Public Access" },
    { name: "Records management audits completed", unit: "audits", category: "Compliance" },
  ],
  OTHER: [],
};

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

interface FinancialYearDef {
  label: string;
  startDate: Date;
  endDate: Date;
}

const FINANCIAL_YEARS: FinancialYearDef[] = [
  { label: "2024/25", startDate: new Date("2024-04-01"), endDate: new Date("2025-03-31") },
  { label: "2025/26", startDate: new Date("2025-04-01"), endDate: new Date("2026-03-31") },
  { label: "2026/27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31") },
];

const TODAY = new Date("2026-09-17");

function quarterDates(fyStart: Date, quarter: Quarter) {
  const qIndex = QUARTERS.indexOf(quarter);
  const start = new Date(fyStart);
  start.setMonth(start.getMonth() + qIndex * 3);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
  const dueDate = new Date(end);
  dueDate.setDate(dueDate.getDate() + 30);
  return { start, end, dueDate };
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = faker.helpers.shuffle(arr);
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const RETURN_REASONS = [
  "Reported figures do not reconcile with the quarterly KPI submissions.",
  "Missing supporting evidence for claimed achievements.",
  "Executive authority sign-off page is missing.",
  "Variance explanations required for underperforming targets.",
];

/**
 * Seeded documents are plain-text stand-ins for real PDFs/Word/Excel files —
 * honest placeholders rather than hand-rolled fake binary formats. The live
 * upload flow (Phase 3 UI) supports real files of those types; this just
 * gives the document repository realistic history to browse and review.
 */
function docBodyText(params: { title: string; entityName: string; typeLabel: string; fyLabel: string; quarter?: Quarter }) {
  return [
    params.title,
    `Entity: ${params.entityName}`,
    `Document type: ${params.typeLabel}`,
    `Financial year: ${params.fyLabel}${params.quarter && params.quarter !== "ANNUAL" ? ` — ${params.quarter}` : ""}`,
    "",
    "This is a synthetic placeholder document generated for the GovTech Hackathon 2026 demo of the",
    "DSAC Public Entities Performance & Reporting Platform. In production this slot holds the entity's",
    "actual submission (PDF, Word or Excel) rather than this plain-text stand-in.",
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

interface VersionOutcome {
  status: ReviewStatus;
  reviewerId?: string;
  comment?: string;
}

/** Weighted, risk-profile-aware review history — 1 version normally, 2 when a return-then-fix story fits. */
function reviewOutcomes(riskProfile: RiskProfile, isCurrent: boolean, dsacReviewerIds: string[]): VersionOutcome[] {
  const reviewer = () => faker.helpers.arrayElement(dsacReviewerIds);
  const returned = () => ({ status: "RETURNED" as ReviewStatus, reviewerId: reviewer(), comment: faker.helpers.arrayElement(RETURN_REASONS) });
  const roll = faker.number.float({ min: 0, max: 1 });

  if (riskProfile === "healthy") {
    if (isCurrent) return roll < 0.6 ? [{ status: "APPROVED", reviewerId: reviewer() }] : [{ status: "UNDER_REVIEW", reviewerId: reviewer() }];
    return [{ status: "APPROVED", reviewerId: reviewer() }];
  }

  if (riskProfile === "watch") {
    if (isCurrent) {
      if (roll < 0.4) return [{ status: "RECEIVED" }];
      if (roll < 0.75) return [{ status: "UNDER_REVIEW", reviewerId: reviewer() }];
      return [returned()];
    }
    if (roll < 0.55) return [{ status: "APPROVED", reviewerId: reviewer() }];
    return [returned(), { status: "APPROVED", reviewerId: reviewer() }];
  }

  // critical
  if (isCurrent) {
    if (roll < 0.3) return [{ status: "RECEIVED" }];
    if (roll < 0.6) return [{ status: "UNDER_REVIEW", reviewerId: reviewer() }];
    return [returned()];
  }
  if (roll < 0.5) return [returned()];
  return [returned(), { status: "APPROVED", reviewerId: reviewer() }];
}

async function seedDocument(params: {
  entityId: string;
  type: DocumentType;
  title: string;
  reportingPeriodId: string;
  authorId: string;
  bodyText: string;
  versions: VersionOutcome[];
  dueDate: Date;
}) {
  const document = await prisma.document.create({
    data: { entityId: params.entityId, type: params.type, title: params.title, reportingPeriodId: params.reportingPeriodId },
  });

  for (let i = 0; i < params.versions.length; i++) {
    const outcome = params.versions[i];
    const versionNumber = i + 1;
    const content = Buffer.from(`${params.bodyText}\n\nVersion ${versionNumber} of ${params.versions.length}.`, "utf-8");
    const checksum = crypto.createHash("sha256").update(content).digest("hex");
    const storageKey = `entities/${params.entityId}/documents/${document.id}/v${versionNumber}-${params.type.toLowerCase()}.txt`;
    await uploadWithRetry(storageKey, content, "text/plain");

    const createdAt = new Date(params.dueDate);
    createdAt.setDate(createdAt.getDate() + i * 3);

    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber,
        storageKey,
        checksum,
        fileSize: content.byteLength,
        mimeType: "text/plain",
        authorId: params.authorId,
        changeNote: versionNumber > 1 ? "Resubmission addressing DSAC feedback." : undefined,
        reviewStatus: outcome.status,
        reviewedById: outcome.reviewerId,
        reviewedAt: outcome.reviewerId ? createdAt : undefined,
        reviewComment: outcome.comment,
        createdAt,
      },
    });
  }
  return document;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Clearing existing data...");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.riskScore.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.deadline.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.workforceStat.deleteMany(),
    prisma.jobCreation.deleteMany(),
    prisma.auditFinding.deleteMany(),
    prisma.expenditure.deleteMany(),
    prisma.fundAllocation.deleteMany(),
    prisma.performanceReport.deleteMany(),
    prisma.kpiMilestone.deleteMany(),
    prisma.kpi.deleteMany(),
    prisma.reportingPeriod.deleteMany(),
    prisma.financialYear.deleteMany(),
    prisma.user.deleteMany(),
    prisma.entity.deleteMany(),
  ]);

  console.log("Creating financial years and reporting periods...");
  const financialYears = new Map<string, { id: string; startDate: Date; endDate: Date }>();
  const reportingPeriods = new Map<string, { id: string; quarter: Quarter; dueDate: Date; endDate: Date }[]>();
  // Year-level documents (Strategic Plan, APP, Annual Report, Financials) anchor to this
  // rather than a specific quarter's ReportingPeriod.
  const annualPeriods = new Map<string, { id: string; dueDate: Date }>();

  for (const fy of FINANCIAL_YEARS) {
    const created = await prisma.financialYear.create({
      data: { label: fy.label, startDate: fy.startDate, endDate: fy.endDate },
    });
    financialYears.set(fy.label, { id: created.id, startDate: fy.startDate, endDate: fy.endDate });

    const periods: { id: string; quarter: Quarter; dueDate: Date; endDate: Date }[] = [];
    for (const quarter of QUARTERS) {
      const { start, end, dueDate } = quarterDates(fy.startDate, quarter);
      const period = await prisma.reportingPeriod.create({
        data: {
          financialYearId: created.id,
          quarter,
          startDate: start,
          endDate: end,
          dueDate,
        },
      });
      periods.push({ id: period.id, quarter, dueDate, endDate: end });
    }
    reportingPeriods.set(fy.label, periods);

    // PFMA-style annual report tabling deadline: ~5 months after year-end.
    const annualDueDate = new Date(fy.endDate);
    annualDueDate.setMonth(annualDueDate.getMonth() + 5);
    const annualPeriod = await prisma.reportingPeriod.create({
      data: {
        financialYearId: created.id,
        quarter: "ANNUAL",
        startDate: fy.startDate,
        endDate: fy.endDate,
        dueDate: annualDueDate,
      },
    });
    annualPeriods.set(fy.label, { id: annualPeriod.id, dueDate: annualDueDate });
  }

  console.log("Creating deadlines...");
  // Global (entityId: null) — the same calendar applies to every entity. The
  // early-warning engine cross-references these against each entity's
  // Document submissions to know who still owes what.
  for (const fy of FINANCIAL_YEARS) {
    const periods = reportingPeriods.get(fy.label)!;
    for (const period of periods) {
      await prisma.deadline.create({
        data: {
          reportingPeriodId: period.id,
          title: `Quarterly Performance Report ${period.quarter} FY ${fy.label}`,
          description: `Quarterly performance report for ${period.quarter}, financial year ${fy.label}.`,
          category: "QUARTERLY_REPORT",
          dueDate: period.dueDate,
        },
      });
    }
    const annual = annualPeriods.get(fy.label)!;
    await prisma.deadline.create({
      data: {
        reportingPeriodId: annual.id,
        title: `Annual Report FY ${fy.label}`,
        description: `Annual report tabling deadline for financial year ${fy.label}.`,
        category: "ANNUAL_REPORT",
        dueDate: annual.dueDate,
      },
    });
  }

  console.log("Creating entities...");
  const entityRecords = new Map<string, { id: string; riskProfile: RiskProfile; sector: EntitySector }>();
  for (const seed of ENTITY_SEEDS) {
    const entity = await prisma.entity.create({
      data: {
        name: seed.name,
        type: seed.type,
        sector: seed.sector,
        description: seed.description,
        fundingAllocation: seed.fundingAllocation,
      },
    });
    entityRecords.set(seed.slug, { id: entity.id, riskProfile: seed.riskProfile, sector: seed.sector });
  }

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const usersByEntity = new Map<string, string[]>(); // entityId -> userIds
  const dsacReviewerIds: string[] = [];

  for (const demoUser of DEMO_USERS) {
    const entityId = demoUser.entitySlug ? entityRecords.get(demoUser.entitySlug)?.id : undefined;
    const user = await prisma.user.create({
      data: {
        name: demoUser.name,
        email: demoUser.email,
        hashedPassword: passwordHash,
        role: demoUser.role,
        entityId,
        isDemoUser: true,
      },
    });
    if (entityId) {
      usersByEntity.set(entityId, [...(usersByEntity.get(entityId) ?? []), user.id]);
    }
    if (demoUser.role === "DSAC_ADMIN" || demoUser.role === "DSAC_ANALYST") {
      dsacReviewerIds.push(user.id);
    }
  }

  // Ensure every entity has at least one admin + one contributor for task/comment assignment.
  for (const [slug, { id: entityId }] of entityRecords) {
    if ((usersByEntity.get(entityId) ?? []).length >= 2) continue;
    const domain = `${slug.replace(/-/g, "")}.demo.org`;
    const admin = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: `admin.${slug}@${domain}`.slice(0, 254),
        hashedPassword: passwordHash,
        role: "ENTITY_ADMIN",
        entityId,
        isDemoUser: true,
      },
    });
    const contributor = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: `contributor.${slug}@${domain}`.slice(0, 254),
        hashedPassword: passwordHash,
        role: "ENTITY_CONTRIBUTOR",
        entityId,
        isDemoUser: true,
      },
    });
    usersByEntity.set(entityId, [...(usersByEntity.get(entityId) ?? []), admin.id, contributor.id]);
  }

  console.log("Creating KPIs, milestones, performance reports, finance, audit and workforce data...");

  for (const seed of ENTITY_SEEDS) {
    const entity = entityRecords.get(seed.slug)!;
    const kpiTemplates = [
      ...pickN(GENERIC_KPI_POOL, faker.number.int({ min: 4, max: 6 })),
      ...pickN(SECTOR_KPI_POOL[seed.sector], faker.number.int({ min: 4, max: 7 })),
    ];

    for (const template of kpiTemplates) {
      const isPercent = template.unit === "%";
      const baseline = isPercent
        ? faker.number.int({ min: 50, max: 75 })
        : faker.number.int({ min: 20, max: 200 });
      const annualTarget = isPercent
        ? faker.number.int({ min: 85, max: 100 })
        : Math.round(baseline * faker.number.float({ min: 1.1, max: 1.4 }));

      for (const fy of FINANCIAL_YEARS) {
        const fyRecord = financialYears.get(fy.label)!;
        const periods = reportingPeriods.get(fy.label)!;
        const isCurrentYear = fy.label === "2026/27";

        const kpi = await prisma.kpi.create({
          data: {
            entityId: entity.id,
            financialYearId: fyRecord.id,
            name: template.name,
            category: template.category,
            unit: template.unit,
            baseline,
            annualTarget,
            status: "NOT_STARTED",
          },
        });

        let lastStatus: KpiStatus = "NOT_STARTED";
        let anyMissed = false;
        let anyAchieved = false;
        let periodsReported = 0;

        for (let qIndex = 0; qIndex < periods.length; qIndex++) {
          const period = periods[qIndex];
          const cumulativeFraction = (qIndex + 1) / periods.length;
          const milestoneTarget = round2(baseline + (annualTarget - baseline) * cumulativeFraction);

          await prisma.kpiMilestone.create({
            data: { kpiId: kpi.id, reportingPeriodId: period.id, targetValue: milestoneTarget },
          });

          const periodIsDue = period.dueDate <= TODAY;
          if (isCurrentYear && !periodIsDue) continue; // future period — nothing to report yet

          // Chance a critical entity simply never submits for this period.
          const skipSubmission = seed.riskProfile === "critical" && faker.number.float({ min: 0, max: 1 }) < 0.2;
          if (skipSubmission) {
            lastStatus = "DEADLINE_MISSED";
            anyMissed = true;
            continue;
          }

          const achievementRatio =
            seed.riskProfile === "healthy"
              ? faker.number.float({ min: 0.95, max: 1.12 })
              : seed.riskProfile === "watch"
                ? faker.number.float({ min: 0.68, max: 0.95 })
                : faker.number.float({ min: 0.35, max: 0.72 });

          const actualValue = round2(milestoneTarget * achievementRatio);

          let status: KpiStatus;
          if (achievementRatio >= 0.95) {
            status = "ACHIEVED";
            anyAchieved = true;
          } else if (achievementRatio < 0.5 && periodIsDue) {
            status = "DEADLINE_MISSED";
            anyMissed = true;
          } else {
            status = "IN_PROGRESS";
          }

          const lateChance =
            seed.riskProfile === "healthy" ? 0.03 : seed.riskProfile === "watch" ? 0.4 : 0.8;
          const isLate = faker.number.float({ min: 0, max: 1 }) < lateChance;
          const lateDays = isLate
            ? faker.number.int({ min: 2, max: seed.riskProfile === "critical" ? 35 : 10 })
            : -faker.number.int({ min: 1, max: 8 });
          const submittedAt = new Date(period.dueDate);
          submittedAt.setDate(submittedAt.getDate() + lateDays);

          await prisma.performanceReport.create({
            data: {
              kpiId: kpi.id,
              reportingPeriodId: period.id,
              actualValue,
              status,
              varianceExplanation:
                status === "DEADLINE_MISSED"
                  ? faker.helpers.arrayElement([
                      "Delayed due to supply chain procurement backlog.",
                      "Vacancy in key project role slowed delivery.",
                      "Funding tranche received later than planned.",
                      "Underlying stakeholder consultation took longer than scoped.",
                    ])
                  : undefined,
              submittedById: faker.helpers.arrayElement(usersByEntity.get(entity.id) ?? []),
              submittedAt,
              isLate,
            },
          });

          lastStatus = status;
          periodsReported++;
        }

        const finalStatus: KpiStatus = periodsReported === 0 ? "NOT_STARTED" : anyMissed && !anyAchieved ? "DEADLINE_MISSED" : lastStatus;
        await prisma.kpi.update({ where: { id: kpi.id }, data: { status: finalStatus } });
      }
    }

    // --- Finance: two tranches per financial year ---
    for (const fy of FINANCIAL_YEARS) {
      const fyRecord = financialYears.get(fy.label)!;
      const isCurrentYear = fy.label === "2026/27";
      const tranche1Amount = round2(seed.fundingAllocation * 0.6);
      const tranche2Amount = round2(seed.fundingAllocation * 0.4);

      const tranche1 = await prisma.fundAllocation.create({
        data: {
          entityId: entity.id,
          financialYearId: fyRecord.id,
          category: "Transfer payment",
          trancheNumber: 1,
          amountAllocated: tranche1Amount,
          dateAllocated: fy.startDate,
        },
      });
      const tranche2Date = new Date(fy.startDate);
      tranche2Date.setMonth(tranche2Date.getMonth() + 6);
      const tranche2 = await prisma.fundAllocation.create({
        data: {
          entityId: entity.id,
          financialYearId: fyRecord.id,
          category: "Transfer payment",
          trancheNumber: 2,
          amountAllocated: tranche2Amount,
          dateAllocated: tranche2Date,
        },
      });

      const utilisationRate = isCurrentYear
        ? seed.riskProfile === "healthy"
          ? faker.number.float({ min: 0.4, max: 0.55 })
          : seed.riskProfile === "watch"
            ? faker.number.float({ min: 0.2, max: 0.4 })
            : faker.number.float({ min: 0.05, max: 0.2 })
        : seed.riskProfile === "healthy"
          ? faker.number.float({ min: 0.92, max: 1.0 })
          : seed.riskProfile === "watch"
            ? faker.number.float({ min: 0.75, max: 0.92 })
            : faker.number.float({ min: 0.45, max: 0.75 });

      const categories = ["Compensation of employees", "Programme delivery", "Goods and services", "Capital expenditure"];
      const totalAllocated = tranche1Amount + tranche2Amount;
      const totalSpend = round2(totalAllocated * utilisationRate);
      let remaining = totalSpend;
      for (let i = 0; i < categories.length; i++) {
        const isLast = i === categories.length - 1;
        const amount = isLast ? remaining : round2(totalSpend * faker.number.float({ min: 0.15, max: 0.35 }));
        remaining -= amount;
        if (amount <= 0) continue;
        await prisma.expenditure.create({
          data: {
            fundAllocationId: faker.helpers.arrayElement([tranche1.id, tranche2.id]),
            amountSpent: amount,
            category: categories[i],
            description: `${categories[i]} spend for FY ${fy.label}`,
            recordedAt: fy.startDate,
          },
        });
      }
    }

    // --- Audit findings (historical years only) ---
    for (const fy of FINANCIAL_YEARS.filter((f) => f.label !== "2026/27")) {
      const fyRecord = financialYears.get(fy.label)!;
      const findingCount =
        seed.riskProfile === "healthy" ? faker.number.int({ min: 0, max: 1 }) : seed.riskProfile === "watch" ? faker.number.int({ min: 1, max: 2 }) : faker.number.int({ min: 2, max: 3 });

      const opinion: AuditOpinion =
        seed.riskProfile === "healthy"
          ? faker.helpers.arrayElement<AuditOpinion>(["CLEAN", "CLEAN", "UNQUALIFIED_WITH_FINDINGS"])
          : seed.riskProfile === "watch"
            ? faker.helpers.arrayElement<AuditOpinion>(["UNQUALIFIED_WITH_FINDINGS", "QUALIFIED"])
            : faker.helpers.arrayElement<AuditOpinion>(["QUALIFIED", "ADVERSE", "DISCLAIMER"]);

      for (let i = 0; i < findingCount; i++) {
        const severity: AuditSeverity =
          seed.riskProfile === "healthy"
            ? "LOW"
            : seed.riskProfile === "watch"
              ? faker.helpers.arrayElement<AuditSeverity>(["LOW", "MEDIUM"])
              : faker.helpers.arrayElement<AuditSeverity>(["MEDIUM", "HIGH", "CRITICAL"]);

        const isResolved = seed.riskProfile === "healthy" || faker.number.float({ min: 0, max: 1 }) > 0.6;

        await prisma.auditFinding.create({
          data: {
            entityId: entity.id,
            financialYearId: fyRecord.id,
            category: faker.helpers.arrayElement(["Supply chain management", "Predetermined objectives", "Financial statements", "Compliance with laws and regulations", "IT governance"]),
            severity,
            status: isResolved ? "RESOLVED" : faker.helpers.arrayElement(["OPEN", "IN_PROGRESS"]),
            auditorOpinion: opinion,
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

    // --- Workforce stats (aggregated) ---
    const genders: Gender[] = ["FEMALE", "MALE", "OTHER"];
    const races: RaceCategory[] = ["AFRICAN", "COLOURED", "INDIAN", "WHITE", "OTHER"];
    const ageBands: AgeBand[] = ["UNDER_25", "AGE_25_34", "AGE_35_44", "AGE_45_54", "AGE_55_PLUS"];
    const disabilityStatuses: DisabilityStatus[] = ["WITHOUT_DISABILITY", "WITH_DISABILITY"];

    for (const fy of FINANCIAL_YEARS) {
      const fyRecord = financialYears.get(fy.label)!;
      const combos = new Set<string>();
      const comboCount = faker.number.int({ min: 12, max: 18 });
      let attempts = 0;
      while (combos.size < comboCount && attempts < comboCount * 5) {
        attempts++;
        const gender = faker.helpers.arrayElement(genders);
        const race = faker.helpers.arrayElement(races);
        const ageBand = faker.helpers.arrayElement(ageBands);
        const disability = faker.helpers.weightedArrayElement([
          { value: disabilityStatuses[0], weight: 9 },
          { value: disabilityStatuses[1], weight: 1 },
        ]);
        combos.add(`${gender}|${race}|${ageBand}|${disability}`);
      }
      for (const combo of combos) {
        const [gender, race, ageBand, disability] = combo.split("|") as [Gender, RaceCategory, AgeBand, DisabilityStatus];
        await prisma.workforceStat.create({
          data: {
            entityId: entity.id,
            financialYearId: fyRecord.id,
            gender,
            raceCategory: race,
            ageBand,
            disabilityStatus: disability,
            headcount: faker.number.int({ min: 1, max: 35 }),
          },
        });
      }

      const jobScale = seed.fundingAllocation / 50_000_000;
      const jobMultiplier = seed.riskProfile === "healthy" ? 1 : seed.riskProfile === "watch" ? 0.7 : 0.4;
      await prisma.jobCreation.createMany({
        data: [
          { entityId: entity.id, financialYearId: fyRecord.id, jobType: "PERMANENT", count: Math.max(1, Math.round(jobScale * 4 * jobMultiplier)) },
          { entityId: entity.id, financialYearId: fyRecord.id, jobType: "TEMPORARY", count: Math.max(1, Math.round(jobScale * 12 * jobMultiplier)) },
          { entityId: entity.id, financialYearId: fyRecord.id, jobType: "YOUTH", count: Math.max(1, Math.round(jobScale * 8 * jobMultiplier)) },
        ],
      });
    }

  }

  console.log("Creating documents (strategic plans, APPs, annual & quarterly reports)...");
  for (const seed of ENTITY_SEEDS) {
    const entity = entityRecords.get(seed.slug)!;
    const author = () => faker.helpers.arrayElement(usersByEntity.get(entity.id) ?? []);

    const oldestFy = FINANCIAL_YEARS[0];
    const oldestFyAnnual = annualPeriods.get(oldestFy.label)!;
    await seedDocument({
      entityId: entity.id,
      type: "STRATEGIC_PLAN",
      title: `${seed.name} Strategic Plan 2024–2029`,
      reportingPeriodId: oldestFyAnnual.id,
      authorId: author(),
      bodyText: docBodyText({
        title: `${seed.name} Strategic Plan 2024–2029`,
        entityName: seed.name,
        typeLabel: "Strategic Plan",
        fyLabel: oldestFy.label,
      }),
      versions: [{ status: "APPROVED", reviewerId: faker.helpers.arrayElement(dsacReviewerIds) }],
      dueDate: oldestFy.startDate,
    });

    for (const fy of FINANCIAL_YEARS) {
      const isCurrent = fy.label === "2026/27";
      const annual = annualPeriods.get(fy.label)!;
      const title = `Annual Performance Plan FY ${fy.label}`;
      await seedDocument({
        entityId: entity.id,
        type: "APP",
        title,
        reportingPeriodId: annual.id,
        authorId: author(),
        bodyText: docBodyText({ title, entityName: seed.name, typeLabel: "Annual Performance Plan", fyLabel: fy.label }),
        versions: reviewOutcomes(seed.riskProfile, isCurrent, dsacReviewerIds),
        dueDate: fy.startDate,
      });
    }

    for (const fy of FINANCIAL_YEARS.filter((f) => f.label !== "2026/27")) {
      const annual = annualPeriods.get(fy.label)!;
      const title = `Annual Report FY ${fy.label}`;
      await seedDocument({
        entityId: entity.id,
        type: "ANNUAL_REPORT",
        title,
        reportingPeriodId: annual.id,
        authorId: author(),
        bodyText: docBodyText({ title, entityName: seed.name, typeLabel: "Annual Report", fyLabel: fy.label }),
        versions: reviewOutcomes(seed.riskProfile, false, dsacReviewerIds),
        dueDate: annual.dueDate,
      });
    }

    for (const fy of FINANCIAL_YEARS) {
      const isCurrentYear = fy.label === "2026/27";
      const periods = reportingPeriods.get(fy.label)!;
      for (const period of periods) {
        if (period.dueDate > TODAY) continue;
        const isMostRecentDue = isCurrentYear && period.quarter === "Q1";
        if (seed.riskProfile === "critical" && isMostRecentDue && faker.number.float({ min: 0, max: 1 }) < 0.15) {
          continue; // simulates a missed submission entirely
        }
        const title = `Quarterly Performance Report ${period.quarter} FY ${fy.label}`;
        await seedDocument({
          entityId: entity.id,
          type: "QUARTERLY_REPORT",
          title,
          reportingPeriodId: period.id,
          authorId: author(),
          bodyText: docBodyText({
            title,
            entityName: seed.name,
            typeLabel: "Quarterly Performance Report",
            fyLabel: fy.label,
            quarter: period.quarter,
          }),
          versions: reviewOutcomes(seed.riskProfile, isMostRecentDue, dsacReviewerIds),
          dueDate: period.dueDate,
        });
      }
    }
  }

  console.log("Creating tasks and comments...");
  const TASK_TEMPLATES: { title: string; direction: "INTERNAL" | "TO_DSAC" | "FROM_DSAC" }[] = [
    { title: "Resubmit returned quarterly report", direction: "FROM_DSAC" },
    { title: "Follow up on outstanding audit finding", direction: "FROM_DSAC" },
    { title: "Request clarification on reported variance", direction: "TO_DSAC" },
    { title: "Prepare board sign-off for annual report", direction: "INTERNAL" },
    { title: "Compile evidence for KPI achievement", direction: "INTERNAL" },
  ];
  const COMMENT_TEMPLATES = [
    "Uploaded the latest quarterly report — please review when you get a chance.",
    "We're still waiting on sign-off from the finance team for this quarter's figures.",
    "Thanks for the quick turnaround on the last review.",
    "Flagging that our Q2 submission may be a few days late this cycle.",
  ];

  for (const seed of ENTITY_SEEDS) {
    const entity = entityRecords.get(seed.slug)!;
    const entityUserIds = usersByEntity.get(entity.id) ?? [];
    if (entityUserIds.length === 0) continue;

    const templates = pickN(TASK_TEMPLATES, faker.number.int({ min: 2, max: 4 }));
    for (const template of templates) {
      const assigneeId = template.direction === "TO_DSAC" ? faker.helpers.arrayElement(dsacReviewerIds) : faker.helpers.arrayElement(entityUserIds);
      const assignerId = template.direction === "FROM_DSAC" ? faker.helpers.arrayElement(dsacReviewerIds) : faker.helpers.arrayElement(entityUserIds);
      const status = faker.helpers.weightedArrayElement([
        { value: "TODO" as const, weight: 4 },
        { value: "IN_PROGRESS" as const, weight: 3 },
        { value: "DONE" as const, weight: 2 },
        { value: "BLOCKED" as const, weight: 1 },
      ]);

      await prisma.task.create({
        data: {
          entityId: entity.id,
          title: template.title,
          assigneeId,
          assignerId,
          direction: template.direction,
          status,
          dueDate: faker.date.soon({ days: 30, refDate: TODAY }),
        },
      });
    }

    if (faker.number.float({ min: 0, max: 1 }) < 0.4) {
      await prisma.comment.create({
        data: {
          entityId: entity.id,
          authorId: faker.helpers.arrayElement(entityUserIds),
          body: faker.helpers.arrayElement(COMMENT_TEMPLATES),
          mentionedUserIds: [],
        },
      });
    }
  }

  console.log("Computing initial risk scores (weighted model + trained logistic regression)...");
  const riskScoreCount = await recalculateAllRiskScores();

  console.log(
    `Seed complete: ${ENTITY_SEEDS.length} entities, ${DEMO_USERS.length} demo users (+ auto-generated), ${riskScoreCount} risk scores computed.`,
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
