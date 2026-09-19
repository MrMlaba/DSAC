-- Aligns the schema with the DSAC reporting-and-oversight spec:
--   * finance:     BudgetLine + QuarterlyExpenditure + Disbursement replace FundAllocation/Expenditure
--   * performance: standard KPI structure (programme / objective / aggregation); statuses are now derived
--   * compliance:  Report (one row per required submission, with the Draft→Finalised workflow) replaces Deadline
--   * requests:    SupportRequest
--   * evidence:    Document can link to a KPI, budget line, report or request
--
-- All data in this prototype is synthetic and is rebuilt by `pnpm db:seed`. The KPI tree is emptied
-- here because Kpi gains NOT NULL columns (programme, objective) that cannot be back-filled.
TRUNCATE TABLE "Kpi" CASCADE;

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('EMPLOYEE_COSTS', 'PROGRAMME_COSTS', 'TRAVEL', 'ADMINISTRATION', 'PROFESSIONAL_FEES', 'CAPITAL_EXPENDITURE', 'OTHER');

-- CreateEnum
CREATE TYPE "KpiAggregation" AS ENUM ('SUM', 'LATEST');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('QUARTERLY_PERFORMANCE', 'QUARTERLY_FINANCIAL', 'GOVERNANCE_RETURN', 'ANNUAL_REPORT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'RETURNED', 'FINALISED');

-- CreateEnum
CREATE TYPE "RequestCategory" AS ENUM ('BUDGET_REQUEST', 'ADDITIONAL_FUNDING', 'TECHNICAL_SUPPORT', 'GOVERNANCE_ASSISTANCE', 'PROGRAMME_SUPPORT', 'CAPACITY_BUILDING');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'MORE_INFO_REQUIRED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REPORT_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_UPDATE';

-- DropForeignKey
ALTER TABLE "Deadline" DROP CONSTRAINT "Deadline_entityId_fkey";

-- DropForeignKey
ALTER TABLE "Deadline" DROP CONSTRAINT "Deadline_reportingPeriodId_fkey";

-- DropForeignKey
ALTER TABLE "Expenditure" DROP CONSTRAINT "Expenditure_fundAllocationId_fkey";

-- DropForeignKey
ALTER TABLE "FundAllocation" DROP CONSTRAINT "FundAllocation_entityId_fkey";

-- DropForeignKey
ALTER TABLE "FundAllocation" DROP CONSTRAINT "FundAllocation_financialYearId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "budgetLineId" TEXT,
ADD COLUMN     "kpiId" TEXT,
ADD COLUMN     "reportId" TEXT,
ADD COLUMN     "requestId" TEXT;

-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "fundingAllocation",
ADD COLUMN     "accountingAuthority" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "establishedYear" INTEGER,
ADD COLUMN     "mandate" TEXT,
ADD COLUMN     "physicalAddress" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Kpi" DROP COLUMN "baseline",
DROP COLUMN "category",
DROP COLUMN "status",
ADD COLUMN     "aggregation" "KpiAggregation" NOT NULL DEFAULT 'SUM',
ADD COLUMN     "objective" TEXT NOT NULL,
ADD COLUMN     "programme" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PerformanceReport" DROP COLUMN "evidenceUrl",
DROP COLUMN "isLate",
DROP COLUMN "status",
ADD COLUMN     "correctiveAction" TEXT;

-- DropTable
DROP TABLE "Deadline";

-- DropTable
DROP TABLE "Expenditure";

-- DropTable
DROP TABLE "FundAllocation";

-- DropEnum
DROP TYPE "DeadlineCategory";

-- DropEnum
DROP TYPE "KpiStatus";

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "annualBudget" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuarterlyExpenditure" (
    "id" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuarterlyExpenditure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "trancheNumber" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "title" TEXT NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "amountRequested" DECIMAL(14,2),
    "motivation" TEXT NOT NULL,
    "linkedProgramme" TEXT,
    "expectedOutcome" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decisionNote" TEXT,
    "createdById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetLine_financialYearId_idx" ON "BudgetLine"("financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_entityId_financialYearId_category_key" ON "BudgetLine"("entityId", "financialYearId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "QuarterlyExpenditure_budgetLineId_quarter_key" ON "QuarterlyExpenditure"("budgetLineId", "quarter");

-- CreateIndex
CREATE INDEX "Disbursement_financialYearId_idx" ON "Disbursement"("financialYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Disbursement_entityId_financialYearId_trancheNumber_key" ON "Disbursement"("entityId", "financialYearId", "trancheNumber");

-- CreateIndex
CREATE INDEX "Report_entityId_financialYearId_idx" ON "Report"("entityId", "financialYearId");

-- CreateIndex
CREATE INDEX "Report_status_dueDate_idx" ON "Report"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Report_entityId_reportingPeriodId_kind_key" ON "Report"("entityId", "reportingPeriodId", "kind");

-- CreateIndex
CREATE INDEX "SupportRequest_entityId_status_idx" ON "SupportRequest"("entityId", "status");

-- CreateIndex
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");

-- CreateIndex
CREATE INDEX "Document_kpiId_idx" ON "Document"("kpiId");

-- CreateIndex
CREATE INDEX "Document_budgetLineId_idx" ON "Document"("budgetLineId");

-- CreateIndex
CREATE INDEX "Document_reportId_idx" ON "Document"("reportId");

-- CreateIndex
CREATE INDEX "Document_requestId_idx" ON "Document"("requestId");

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuarterlyExpenditure" ADD CONSTRAINT "QuarterlyExpenditure_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "FinancialYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

