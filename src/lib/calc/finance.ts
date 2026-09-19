import { ratio, subtractMoney, sumMoney } from "./money";

export type FinanceQuarter = "Q1" | "Q2" | "Q3" | "Q4";
export const FINANCE_QUARTERS: readonly FinanceQuarter[] = ["Q1", "Q2", "Q3", "Q4"];

/** One approved expense line for one entity in one financial year, plus what was spent in each reported quarter. */
export interface BudgetLineInput {
  id: string;
  category: string;
  annualBudget: number;
  /** Expenditure entered for that quarter alone (NOT cumulative). Missing key = not reported. */
  quarterly: Partial<Record<FinanceQuarter, number>>;
}

export interface QuarterBreakdown {
  quarter: FinanceQuarter;
  /** This quarter's own expenditure; null when the quarter hasn't been reported. */
  amount: number | null;
  cumulative: number;
  cumulativeUtilisation: number | null;
}

export interface FinanceLine {
  id: string;
  category: string;
  annualBudget: number;
  /** Sum of every reported quarter — the "actual to date" shown in the normal DSAC view. */
  actualToDate: number;
  /** annualBudget − actualToDate. Negative when the line is overspent. */
  remaining: number;
  /** actualToDate ÷ annualBudget. */
  utilisation: number | null;
  overspent: boolean;
  quarters: QuarterBreakdown[];
  latestQuarter: FinanceQuarter | null;
}

/** The three raw money figures every financial statement in the app is derived from. */
export interface FinanceTotals {
  approved: number;
  disbursed: number;
  utilised: number;
}

export interface FinanceSummary extends FinanceTotals {
  /** approved − utilised */
  remainingBudget: number;
  /** approved − disbursed: budget DSAC has not yet released. */
  undisbursed: number;
  /** disbursed − utilised: released to the entity but not yet spent. */
  unspentDisbursed: number;
  /** utilised ÷ approved. Used for "Budget utilisation" and every per-line utilisation. */
  budgetUtilisation: number | null;
  /** utilised ÷ disbursed. Used for "Fund utilisation" (the portfolio headline and entity finance summary). */
  fundUtilisation: number | null;
  /** disbursed ÷ approved */
  disbursementRate: number | null;
}

export function calcFinanceLine(input: BudgetLineInput): FinanceLine {
  let running = 0;
  const quarters: QuarterBreakdown[] = FINANCE_QUARTERS.map((quarter) => {
    const amount = input.quarterly[quarter] ?? null;
    running = sumMoney([running, amount ?? 0]);
    return {
      quarter,
      amount,
      cumulative: running,
      cumulativeUtilisation: ratio(running, input.annualBudget),
    };
  });

  const reportedQuarters = quarters.filter((q) => q.amount !== null);
  const actualToDate = sumMoney(reportedQuarters.map((q) => q.amount as number));

  return {
    id: input.id,
    category: input.category,
    annualBudget: input.annualBudget,
    actualToDate,
    remaining: subtractMoney(input.annualBudget, actualToDate),
    utilisation: ratio(actualToDate, input.annualBudget),
    overspent: actualToDate > input.annualBudget,
    quarters,
    latestQuarter: reportedQuarters.at(-1)?.quarter ?? null,
  };
}

export function summariseFinance(totals: FinanceTotals): FinanceSummary {
  return {
    ...totals,
    remainingBudget: subtractMoney(totals.approved, totals.utilised),
    undisbursed: subtractMoney(totals.approved, totals.disbursed),
    unspentDisbursed: subtractMoney(totals.disbursed, totals.utilised),
    budgetUtilisation: ratio(totals.utilised, totals.approved),
    fundUtilisation: ratio(totals.utilised, totals.disbursed),
    disbursementRate: ratio(totals.disbursed, totals.approved),
  };
}

/**
 * Entity-level finance. The summary's approved and utilised figures are the
 * sums of the lines themselves, so the totals row, the overview cards and the
 * portfolio roll-up can never disagree with the line table.
 */
export function calcEntityFinance(lines: BudgetLineInput[], disbursements: readonly number[]) {
  const calculated = lines.map(calcFinanceLine);
  const summary = summariseFinance({
    approved: sumMoney(calculated.map((l) => l.annualBudget)),
    disbursed: sumMoney(disbursements),
    utilised: sumMoney(calculated.map((l) => l.actualToDate)),
  });

  const quarterOrder = FINANCE_QUARTERS.filter((q) => calculated.some((l) => l.quarters.find((b) => b.quarter === q)?.amount != null));
  return { lines: calculated, summary, latestQuarter: quarterOrder.at(-1) ?? null };
}

/** Portfolio roll-up: sum the raw figures first, derive ratios last. */
export function combineFinance(entities: readonly FinanceTotals[]): FinanceSummary {
  return summariseFinance({
    approved: sumMoney(entities.map((e) => e.approved)),
    disbursed: sumMoney(entities.map((e) => e.disbursed)),
    utilised: sumMoney(entities.map((e) => e.utilised)),
  });
}
