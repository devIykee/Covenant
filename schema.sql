-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fundingGoal" TEXT NOT NULL,
    "milestoneDescription" TEXT NOT NULL,
    "deadlineBlock" INTEGER NOT NULL,
    "deadlineAt" DATETIME,
    "disputeWindowBlocks" INTEGER NOT NULL DEFAULT 144,
    "builderAddress" TEXT NOT NULL,
    "treasuryAddress" TEXT NOT NULL,
    "judges" TEXT NOT NULL DEFAULT '[]',
    "minFundingBps" INTEGER NOT NULL DEFAULT 10000,
    "builderAcceptedPartial" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "pooledTxid" TEXT,
    "pooledExplorerUrl" TEXT,
    "withdrawTxid" TEXT,
    "withdrawExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BackerContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "depositTxid" TEXT,
    "depositExplorerUrl" TEXT,
    "refundTxid" TEXT,
    "refundExplorerUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackerContribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JudgeAttestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "judge" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JudgeAttestation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectStateLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "txid" TEXT,
    "explorerUrl" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectStateLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Distribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Distribution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
CREATE UNIQUE INDEX "JudgeAttestation_projectId_judge_key" ON "JudgeAttestation"("projectId", "judge");

-- CreateIndex
CREATE UNIQUE INDEX "Reputation_principal_key" ON "Reputation"("principal");

