-- Auth-as-a-Service, scoped per dev Project (Supabase/Firebase-Auth-style).

CREATE TYPE "OAuthProvider" AS ENUM ('google', 'github', 'discord');

CREATE TABLE "ProjectAuthUser" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "ProjectAuthUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectAuthUser_projectId_email_key" ON "ProjectAuthUser"("projectId", "email");

ALTER TABLE "ProjectAuthUser" ADD CONSTRAINT "ProjectAuthUser_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProjectOAuthAccount" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectOAuthAccount_provider_providerUserId_key" ON "ProjectOAuthAccount"("provider", "providerUserId");

ALTER TABLE "ProjectOAuthAccount" ADD CONSTRAINT "ProjectOAuthAccount_authUserId_fkey"
  FOREIGN KEY ("authUserId") REFERENCES "ProjectAuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProjectOAuthConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOAuthConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectOAuthConfig_projectId_provider_key" ON "ProjectOAuthConfig"("projectId", "provider");

ALTER TABLE "ProjectOAuthConfig" ADD CONSTRAINT "ProjectOAuthConfig_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProjectMagicLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMagicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMagicLink_tokenHash_key" ON "ProjectMagicLink"("tokenHash");

ALTER TABLE "ProjectMagicLink" ADD CONSTRAINT "ProjectMagicLink_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
