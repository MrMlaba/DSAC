import { recalculateAllRiskScores } from "@/lib/risk-engine";

export async function runRiskRecalculation() {
  return recalculateAllRiskScores();
}
