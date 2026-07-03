Loaded Prisma config from prisma.config.ts.

-- CreateTable
CREATE TABLE "GrantProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conditions" TEXT NOT NULL DEFAULT '',
    "grantorAddress" TEXT NOT NULL,
    "totalPool" TEXT NOT NULL,
    "custodianAddress" TEXT NOT NULL DEFAULT '',
    "programDeadlineAt" DATETIME,
    "programDeadlineBlock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fundTxid" TEXT,
    "fundExplorerUrl" TEXT,
    "lockTxid" TEXT,
    "lockExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "builderAddress" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_programId_fkey" FOREIGN KEY ("programId") REFERENCES "GrantProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "builderAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "judges" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeMilestoneIndex" INTEGER NOT NULL DEFAULT 0,
    "initialBps" INTEGER NOT NULL DEFAULT 0,
    "initialAmount" TEXT NOT NULL DEFAULT '0',
    "initialTxid" TEXT,
    "initialExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Award_programId_fkey" FOREIGN KEY ("programId") REFERENCES "GrantProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "awardId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "deadlineAt" DATETIME,
    "deadlineBlock" INTEGER NOT NULL DEFAULT 0,
    "percentBps" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "lockUntilBlock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "withdrawTxid" TEXT,
    "withdrawExplorerUrl" TEXT,
    "payoutTxid" TEXT,
    "payoutExplorerUrl" TEXT,
    "relockTxid" TEXT,
    "relockExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MilestoneAttestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "milestoneId" TEXT NOT NULL,
    "judge" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MilestoneAttestation_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "awardId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Distribution_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramStateLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "txid" TEXT,
    "explorerUrl" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramStateLog_programId_fkey" FOREIGN KEY ("programId") REFERENCES "GrantProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reputation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "principal" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PayrollVault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payerAddress" TEXT NOT NULL,
    "contributorAddress" TEXT NOT NULL,
    "totalBudget" TEXT NOT NULL,
    "intervalAmount" TEXT NOT NULL,
    "releasedAmount" TEXT NOT NULL DEFAULT '0',
    "depositTxid" TEXT,
    "depositExplorerUrl" TEXT,
    "startBlock" INTEGER NOT NULL DEFAULT 0,
    "endBlock" INTEGER NOT NULL DEFAULT 0,
    "lastReleasedBlock" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "clawbackTxid" TEXT,
    "clawbackExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payrollId" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "intervalBlock" INTEGER NOT NULL,
    "amount" TEXT,
    "txid" TEXT,
    "explorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckIn_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "PayrollVault" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReputationVault" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "totalAmount" TEXT NOT NULL,
    "lockUntilBlock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "depositTxid" TEXT,
    "depositExplorerUrl" TEXT,
    "pooledTxid" TEXT,
    "resolvedTxid" TEXT,
    "resolvedExplorerUrl" TEXT,
    "payouts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReputationVaultParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vaultId" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "reputationAtTime" INTEGER NOT NULL,
    "computedShareBps" INTEGER NOT NULL,
    CONSTRAINT "ReputationVaultParticipant_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "ReputationVault" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsurancePool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "triggerCondition" TEXT NOT NULL DEFAULT 'INCIDENT_DECLARED',
    "lockUntilBlock" INTEGER NOT NULL DEFAULT 0,
    "returnOnExpiry" TEXT NOT NULL DEFAULT 'REFUND',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "pooledTxid" TEXT,
    "resolvedTxid" TEXT,
    "resolvedExplorerUrl" TEXT,
    "payouts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InsuranceContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "depositTxid" TEXT,
    "depositExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsuranceContribution_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "InsurancePool" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "amount" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Award_programId_key" ON "Award"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_awardId_index_key" ON "Milestone"("awardId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneAttestation_milestoneId_judge_key" ON "MilestoneAttestation"("milestoneId", "judge");

-- CreateIndex
CREATE UNIQUE INDEX "Reputation_principal_key" ON "Reputation"("principal");

