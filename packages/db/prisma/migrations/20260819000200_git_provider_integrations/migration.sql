-- Replaces the old unpersisted in-memory gitUserAccounts store with real,
-- provider-native, persisted connections (audit findings H7/H8/H10
-- rewrite): GitHub App installations (no PAT, only an installation ID --
-- API access uses short-lived installation tokens minted on demand) and
-- GitLab OAuth application connections (access + refresh token, encrypted
-- at rest, auto-refreshed).

CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");
CREATE INDEX "GitHubInstallation_userId_idx" ON "GitHubInstallation"("userId");

ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GitLabConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gitlabUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitLabConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitLabConnection_userId_gitlabUserId_key" ON "GitLabConnection"("userId", "gitlabUserId");

ALTER TABLE "GitLabConnection" ADD CONSTRAINT "GitLabConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
