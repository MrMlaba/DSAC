import { PrismaClient, type Quarter, type KpiStatus, type Gender, type RaceCategory, type AgeBand, type DisabilityStatus, type AuditOpinion, type AuditSeverity, type RiskBand } from "@prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { ENTITY_SEEDS, type EntitySector, type RiskProfile } from "../src/lib/seed-data/entities";
import { DEMO_USERS, DEMO_PASSWORD } from "../src/lib/seed-data/demo-users";

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

    // --- Placeholder risk score (Phase 4 replaces this with the full weighted/explainable engine) ---
    const score =
      seed.riskProfile === "healthy"
        ? faker.number.int({ min: 8, max: 28 })
        : seed.riskProfile === "watch"
          ? faker.number.int({ min: 35, max: 64 })
          : faker.number.int({ min: 68, max: 96 });
    const band: RiskBand = score < 25 ? "LOW" : score < 50 ? "MEDIUM" : score < 75 ? "HIGH" : "CRITICAL";

    await prisma.riskScore.create({
      data: {
        entityId: entity.id,
        score,
        band,
        factors: {
          note: "Placeholder score seeded for Phase 1/2 dashboards — replaced by the weighted early-warning engine in Phase 4.",
          riskProfile: seed.riskProfile,
        },
        computedAt: TODAY,
      },
    });
  }

  console.log(`Seed complete: ${ENTITY_SEEDS.length} entities, ${DEMO_USERS.length} demo users (+ auto-generated).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
