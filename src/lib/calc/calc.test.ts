import { describe, expect, it } from "vitest";
import { ratio, sumMoney } from "./money";
import { calcEntityFinance, calcFinanceLine, combineFinance, summariseFinance } from "./finance";
import {
  assessmentQuarter,
  calcKpi,
  combinePerformance,
  kpiStatusFromAchievement,
  latestDueQuarter,
  meanCappedAchievement,
  performanceBand,
  summarisePerformance,
  type KpiInput,
} from "./performance";
import { combineCompliance, complianceOf, daysUntilDue, summariseCompliance, type ComplianceItem } from "./compliance";
import { formatPercent, formatRand, formatRandCompact, formatSigned } from "@/lib/format";
import { annualReportDueDate, quarterBounds, quarterlyReportDueDate, reportTitle } from "@/lib/reporting-calendar";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("money", () => {
  it("adds through integer cents so there is no floating-point drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([1234567.89, 0.11, 99.99])).toBe(1234667.99);
  });

  it("returns null instead of dividing by zero", () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(0, 10)).toBe(0);
  });
});

describe("finance — the spec's expense-line table", () => {
  const lines = [
    { id: "emp", category: "Employee Costs", annualBudget: 5_000_000, quarterly: { Q1: 2_100_000 } },
    { id: "prg", category: "Programme Costs", annualBudget: 10_000_000, quarterly: { Q1: 2_000_000, Q2: 2_800_000 } },
    { id: "trv", category: "Travel", annualBudget: 1_000_000, quarterly: { Q1: 410_000 } },
    { id: "adm", category: "Administration", annualBudget: 2_000_000, quarterly: { Q1: 900_000 } },
  ];

  it("shows annual budget vs cumulative actual, remaining and utilisation per line", () => {
    const [emp, prg, trv, adm] = lines.map(calcFinanceLine);
    expect([emp.actualToDate, emp.remaining, emp.utilisation]).toEqual([2_100_000, 2_900_000, 0.42]);
    expect(formatPercent(emp.utilisation)).toBe("42%");
    expect(prg.actualToDate).toBe(4_800_000);
    expect(prg.remaining).toBe(5_200_000);
    expect(formatPercent(prg.utilisation)).toBe("48%");
    expect(trv.remaining).toBe(590_000);
    expect(formatPercent(trv.utilisation)).toBe("41%");
    expect(adm.remaining).toBe(1_100_000);
    expect(formatPercent(adm.utilisation)).toBe("45%");
  });

  it("accumulates quarterly entries onto the same annual budget (Programme Costs example)", () => {
    const line = calcFinanceLine({ id: "prg", category: "Programme Costs", annualBudget: 10_000_000, quarterly: { Q1: 2_000_000, Q2: 2_800_000, Q3: 2_300_000 } });
    const cumulative = line.quarters.map((q) => [q.quarter, q.cumulative, formatPercent(q.cumulativeUtilisation)]);
    expect(cumulative).toEqual([
      ["Q1", 2_000_000, "20%"],
      ["Q2", 4_800_000, "48%"],
      ["Q3", 7_100_000, "71%"],
      ["Q4", 7_100_000, "71%"],
    ]);
    expect(line.actualToDate).toBe(7_100_000);
    expect(line.latestQuarter).toBe("Q3");
  });

  it("flags an overspent line with a negative remaining budget", () => {
    const line = calcFinanceLine({ id: "x", category: "Travel", annualBudget: 1_000_000, quarterly: { Q1: 600_000, Q2: 520_000 } });
    expect(line.overspent).toBe(true);
    expect(line.remaining).toBe(-120_000);
    expect(formatPercent(line.utilisation)).toBe("112%");
  });

  it("derives entity totals from the lines, so the totals row can never disagree with the table", () => {
    const { lines: calculated, summary } = calcEntityFinance(lines, [10_000_000]);
    expect(summary.approved).toBe(sumMoney(calculated.map((l) => l.annualBudget)));
    expect(summary.utilised).toBe(sumMoney(calculated.map((l) => l.actualToDate)));
    expect(summary.approved).toBe(18_000_000);
    expect(summary.utilised).toBe(8_210_000); // 2.1m + 4.8m + 0.41m + 0.9m
  });
});

describe("finance — entity and portfolio summaries", () => {
  it("entity example: R20m approved, R15m disbursed, R11.5m spent → 76.7% of disbursed, 57.5% of approved", () => {
    const s = summariseFinance({ approved: 20_000_000, disbursed: 15_000_000, utilised: 11_500_000 });
    expect(formatPercent(s.fundUtilisation)).toBe("76.7%");
    expect(formatPercent(s.budgetUtilisation)).toBe("57.5%");
    expect(s.remainingBudget).toBe(8_500_000);
    expect(s.undisbursed).toBe(5_000_000);
    expect(s.unspentDisbursed).toBe(3_500_000);
    expect(formatPercent(s.disbursementRate)).toBe("75%");
  });

  it("portfolio example: R2.4bn approved, R1.8bn disbursed, R1.35bn utilised → 75%", () => {
    const s = summariseFinance({ approved: 2_400_000_000, disbursed: 1_800_000_000, utilised: 1_350_000_000 });
    expect(formatPercent(s.fundUtilisation)).toBe("75%");
    expect(formatRandCompact(s.approved)).toBe("R2.4bn");
    expect(formatRandCompact(s.disbursed)).toBe("R1.8bn");
    expect(formatRandCompact(s.utilised)).toBe("R1.35bn");
  });

  it("portfolio utilisation is total ÷ total — not an average of entity percentages", () => {
    const small = { approved: 10_000_000, disbursed: 10_000_000, utilised: 2_000_000 }; // 20%
    const large = { approved: 400_000_000, disbursed: 400_000_000, utilised: 380_000_000 }; // 95%
    const combined = combineFinance([small, large]);
    const naiveAverage = (0.2 + 0.95) / 2;
    expect(combined.fundUtilisation).toBeCloseTo(382 / 410, 10);
    expect(combined.fundUtilisation).not.toBeCloseTo(naiveAverage, 2);
  });

  it("portfolio totals equal the sum of the entities, to the cent", () => {
    const entities = [
      { approved: 51_000_000.5, disbursed: 25_500_000.25, utilised: 10_000_000.1 },
      { approved: 9_500_000.33, disbursed: 4_750_000.17, utilised: 3_000_000.2 },
    ];
    const combined = combineFinance(entities);
    expect(combined.approved).toBe(60_500_000.83);
    expect(combined.disbursed).toBe(30_250_000.42);
    expect(combined.utilised).toBe(13_000_000.3);
  });

  it("shows — rather than 0% when nothing has been disbursed", () => {
    const s = summariseFinance({ approved: 1_000_000, disbursed: 0, utilised: 0 });
    expect(s.fundUtilisation).toBeNull();
    expect(formatPercent(s.fundUtilisation)).toBe("—");
    expect(s.budgetUtilisation).toBe(0);
  });
});

describe("performance — the spec's quarterly example", () => {
  // Annual target 20,000 beneficiaries, phased 15% / 30% / 30% / 25%.
  const beneficiaries: KpiInput = {
    id: "k1",
    annualTarget: 20_000,
    aggregation: "SUM",
    quarters: {
      Q1: { target: 3_000, actual: 4_100 },
      Q2: { target: 6_000, actual: 4_200 },
      Q3: { target: 6_000, actual: null },
      Q4: { target: 5_000, actual: null },
    },
  };

  it("adds Q1 + Q2 to get the year-to-date figures and derives variance and achievement", () => {
    const r = calcKpi(beneficiaries, "Q2");
    expect(r.ytdTarget).toBe(9_000);
    expect(r.ytdActual).toBe(8_300);
    expect(r.variance).toBe(-700);
    expect(formatSigned(r.variance)).toBe("−700");
    expect(formatPercent(r.achievement)).toBe("92.2%");
    expect(formatPercent(r.annualProgress)).toBe("41.5%");
    expect(r.periodTarget).toBe(6_000);
    expect(r.periodActual).toBe(4_200);
    expect(r.status).toBe("ON_TRACK");
  });

  it("uses the latest value for rate KPIs instead of adding quarters together", () => {
    const rate: KpiInput = {
      id: "k2",
      annualTarget: 95,
      aggregation: "LATEST",
      quarters: {
        Q1: { target: 80, actual: 78 },
        Q2: { target: 85, actual: 84 },
        Q3: { target: 90, actual: null },
        Q4: { target: 95, actual: null },
      },
    };
    const r = calcKpi(rate, "Q2");
    expect(r.ytdTarget).toBe(85);
    expect(r.ytdActual).toBe(84);
    expect(r.variance).toBe(-1);
    expect(formatPercent(r.achievement)).toBe("98.8%");
  });

  it("treats an unreported quarter as zero delivered, not as skipped", () => {
    const r = calcKpi({ ...beneficiaries, quarters: { ...beneficiaries.quarters, Q1: { target: 3_000, actual: null }, Q2: { target: 6_000, actual: null } } }, "Q2");
    expect(r.ytdActual).toBe(0);
    expect(r.reported).toBe(false);
    expect(r.status).toBe("NOT_ACHIEVED");
  });

  it("has no status until a target has fallen due", () => {
    const r = calcKpi({ ...beneficiaries, quarters: { Q1: { target: null, actual: null }, Q2: { target: null, actual: null }, Q3: { target: null, actual: null }, Q4: { target: null, actual: null } } }, "Q1");
    expect(r.status).toBeNull();
    expect(r.achievement).toBeNull();
  });

  it("maps achievement to Achieved / On track / At risk / Not achieved at the documented cut-offs", () => {
    expect(kpiStatusFromAchievement(1.2)).toBe("ACHIEVED");
    expect(kpiStatusFromAchievement(1)).toBe("ACHIEVED");
    expect(kpiStatusFromAchievement(0.9999)).toBe("ON_TRACK");
    expect(kpiStatusFromAchievement(0.85)).toBe("ON_TRACK");
    expect(kpiStatusFromAchievement(0.8499)).toBe("AT_RISK");
    expect(kpiStatusFromAchievement(0.6)).toBe("AT_RISK");
    expect(kpiStatusFromAchievement(0.5999)).toBe("NOT_ACHIEVED");
    expect(kpiStatusFromAchievement(null)).toBe("NOT_ACHIEVED");
  });
});

describe("performance — overall and portfolio roll-up", () => {
  it("overall performance = (achieved + on track) ÷ assessed KPIs", () => {
    // 78% of targets achieved / on track — the entity dashboard example.
    const statuses = [...Array(50).fill("ACHIEVED"), ...Array(28).fill("ON_TRACK"), ...Array(12).fill("AT_RISK"), ...Array(10).fill("NOT_ACHIEVED")];
    const summary = summarisePerformance(statuses.map((status) => ({ status })));
    expect(summary.assessed).toBe(100);
    expect(formatPercent(summary.overall)).toBe("78%");
  });

  it("ignores KPIs that are not yet assessable", () => {
    const summary = summarisePerformance([{ status: "ACHIEVED" }, { status: null }, { status: "AT_RISK" }]);
    expect(summary.assessed).toBe(2);
    expect(summary.overall).toBe(0.5);
  });

  it("pools KPI counts across entities instead of averaging entity percentages", () => {
    const a = summarisePerformance([{ status: "ACHIEVED" }]); // 100% over 1 KPI
    const b = summarisePerformance([...Array(9).fill({ status: "NOT_ACHIEVED" }), { status: "ACHIEVED" }]); // 10% over 10 KPIs
    const combined = combinePerformance([a, b]);
    expect(combined.assessed).toBe(11);
    expect(combined.overall).toBeCloseTo(2 / 11, 10);
  });

  it("bands an entity's overall performance", () => {
    expect(performanceBand(0.95)).toBe("ON_TRACK");
    expect(performanceBand(0.7)).toBe("ON_TRACK");
    expect(performanceBand(0.55)).toBe("AT_RISK");
    expect(performanceBand(0.39)).toBe("UNDER_TARGET");
    expect(performanceBand(null)).toBe("NO_DATA");
  });

  it("caps each KPI at 100% so one over-delivering KPI cannot hide a failing one", () => {
    const mean = meanCappedAchievement([
      { achievement: 2.5, status: "ACHIEVED" },
      { achievement: 0.5, status: "NOT_ACHIEVED" },
    ]);
    expect(mean).toBe(0.75);
  });

  it("assesses at the later of the last-due quarter and the last quarter with data", () => {
    const due = { Q1: utc("2026-07-31"), Q2: utc("2026-10-31"), Q3: utc("2027-01-31"), Q4: utc("2027-04-30") };
    expect(latestDueQuarter(due, utc("2026-09-19"))).toBe("Q1");
    expect(latestDueQuarter(due, utc("2026-07-31"))).toBeNull();
    expect(latestDueQuarter(due, utc("2026-11-01"))).toBe("Q2");
    expect(assessmentQuarter("Q1", null)).toBe("Q1");
    expect(assessmentQuarter("Q1", "Q2")).toBe("Q2");
    expect(assessmentQuarter("Q2", "Q1")).toBe("Q2");
    expect(assessmentQuarter(null, null)).toBeNull();
  });
});

describe("compliance — green / amber / red", () => {
  const today = utc("2026-07-20");
  const item = (status: ComplianceItem["status"], dueDate: string, submittedAt: string | null = null): ComplianceItem => ({
    status,
    dueDate: utc(dueDate),
    submittedAt: submittedAt ? utc(submittedAt) : null,
  });

  it("matches the spec's compliance table", () => {
    // Quarterly Performance Report — due 31 July, submitted 29 July → Compliant
    expect(complianceOf(item("SUBMITTED", "2026-07-31", "2026-07-29"), today)).toMatchObject({ state: "COMPLIANT", colour: "green" });
    // Financial Report — due 31 July, not submitted → Due soon
    expect(complianceOf(item("DRAFT", "2026-07-31"), today)).toMatchObject({ state: "DUE_SOON", colour: "amber", daysUntilDue: 11 });
    // Governance Return — due 15 August, not submitted, beyond the due-soon window
    expect(complianceOf(item("DRAFT", "2026-09-30"), today)).toMatchObject({ state: "UPCOMING", colour: "neutral" });
  });

  it("is red once the due date has passed without a submission — but not on the due date itself", () => {
    expect(complianceOf(item("DRAFT", "2026-07-20"), today).state).toBe("DUE_SOON");
    const overdue = complianceOf(item("DRAFT", "2026-07-18"), today);
    expect(overdue).toMatchObject({ state: "OVERDUE", colour: "red", daysUntilDue: -2 });
  });

  it("treats a late submission and a returned report as amber", () => {
    expect(complianceOf(item("ACCEPTED", "2026-07-10", "2026-07-15"), today)).toMatchObject({ state: "LATE_SUBMISSION", colour: "amber" });
    expect(complianceOf(item("RETURNED", "2026-07-10", "2026-07-08"), today)).toMatchObject({ state: "RETURNED", colour: "amber" });
  });

  it("counts whole days between dates in UTC", () => {
    expect(daysUntilDue(utc("2026-07-31"), utc("2026-07-21"))).toBe(10);
    expect(daysUntilDue(utc("2026-07-31"), new Date("2026-07-31T22:00:00Z"))).toBe(0);
  });

  it("summarises an entity: submitted, outstanding, not yet due — and they add up", () => {
    const items = [
      item("ACCEPTED", "2026-06-30", "2026-06-25"), // compliant
      item("FINALISED", "2026-06-30", "2026-07-03"), // late
      item("RETURNED", "2026-06-30", "2026-06-29"), // owed: returned & past due
      item("DRAFT", "2026-07-10"), // overdue
      item("DRAFT", "2026-07-25"), // due soon
      item("DRAFT", "2026-12-31"), // upcoming
    ];
    const s = summariseCompliance(items, today);
    expect(s.total).toBe(6);
    expect(s.submitted).toBe(2);
    expect(s.outstanding).toBe(2);
    expect(s.notYetDue).toBe(2);
    expect(s.submitted + s.outstanding + s.notYetDue).toBe(s.total);
    expect(s.assessed).toBe(4); // two delivered + two past due
    expect(s.compliant).toBe(1);
    expect(s.rate).toBe(0.25);
    expect(s.status).toBe("OVERDUE_REPORTING");
  });

  it("derives the entity status from the worst item", () => {
    expect(summariseCompliance([item("ACCEPTED", "2026-06-30", "2026-06-25"), item("DRAFT", "2026-12-31")], today).status).toBe("COMPLIANT");
    expect(summariseCompliance([item("RETURNED", "2026-08-30", "2026-07-01")], today).status).toBe("ATTENTION_REQUIRED");
    expect(summariseCompliance([item("DRAFT", "2026-07-25")], today).status).toBe("ATTENTION_REQUIRED");
  });

  it("pools portfolio compliance counts rather than averaging rates", () => {
    const a = summariseCompliance([item("ACCEPTED", "2026-06-30", "2026-06-25")], today); // 1/1
    const b = summariseCompliance([item("DRAFT", "2026-07-01"), item("DRAFT", "2026-07-02"), item("DRAFT", "2026-07-03"), item("ACCEPTED", "2026-06-30", "2026-06-25")], today); // 1/4
    const combined = combineCompliance([a, b]);
    expect(combined.assessed).toBe(5);
    expect(combined.compliant).toBe(2);
    expect(combined.rate).toBe(0.4);
  });
});

describe("reporting calendar", () => {
  const fyStart = utc("2026-04-01");

  it("matches the spec's due dates: Q1 reports 31 July, governance return 15 August, Q2 report 31 October", () => {
    expect(quarterlyReportDueDate("QUARTERLY_PERFORMANCE", fyStart, "Q1")).toEqual(utc("2026-07-31"));
    expect(quarterlyReportDueDate("QUARTERLY_FINANCIAL", fyStart, "Q1")).toEqual(utc("2026-07-31"));
    expect(quarterlyReportDueDate("GOVERNANCE_RETURN", fyStart, "Q1")).toEqual(utc("2026-08-15"));
    expect(quarterlyReportDueDate("QUARTERLY_PERFORMANCE", fyStart, "Q2")).toEqual(utc("2026-10-31"));
    expect(quarterlyReportDueDate("QUARTERLY_PERFORMANCE", fyStart, "Q3")).toEqual(utc("2027-01-31"));
    expect(quarterlyReportDueDate("QUARTERLY_PERFORMANCE", fyStart, "Q4")).toEqual(utc("2027-04-30"));
    expect(quarterlyReportDueDate("GOVERNANCE_RETURN", fyStart, "Q4")).toEqual(utc("2027-05-15"));
    expect(annualReportDueDate(utc("2027-03-31"))).toEqual(utc("2027-08-31"));
  });

  it("computes quarter bounds", () => {
    expect(quarterBounds(fyStart, "Q1")).toEqual({ start: utc("2026-04-01"), end: utc("2026-06-30") });
    expect(quarterBounds(fyStart, "Q4")).toEqual({ start: utc("2027-01-01"), end: utc("2027-03-31") });
  });

  it("titles reports", () => {
    expect(reportTitle("QUARTERLY_PERFORMANCE", "2026/27", "Q2")).toBe("Quarterly Performance Report Q2 FY 2026/27");
    expect(reportTitle("ANNUAL_REPORT", "2026/27")).toBe("Annual Report FY 2026/27");
  });
});

describe("formatting", () => {
  it("formats rand exactly and compactly", () => {
    expect(formatRand(5_000_000)).toBe("R5,000,000");
    expect(formatRand(-590_000)).toBe("-R590,000");
    expect(formatRandCompact(11_500_000)).toBe("R11.5m");
    expect(formatRandCompact(850_000)).toBe("R850k");
    expect(formatRandCompact(2_400_000_000)).toBe("R2.4bn");
  });

  it("formats percentages from the unrounded ratio, dropping a trailing .0", () => {
    expect(formatPercent(0.75)).toBe("75%");
    expect(formatPercent(0.7666667)).toBe("76.7%");
    expect(formatPercent(0.9222)).toBe("92.2%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe("—");
  });
});
