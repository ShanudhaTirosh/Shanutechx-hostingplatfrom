-- Audit finding C3: replaces the old global, unscoped in-memory webmail
-- message store with a real, per-user-owned table. Every message now
-- belongs to exactly one User (and optionally one SmtpAccount mailbox),
-- closing the cross-tenant IDOR where any authenticated user could read/
-- modify/delete any other user's webmail messages.

CREATE TABLE "WebmailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "smtpAccountId" TEXT,
    "folder" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebmailMessage_userId_folder_idx" ON "WebmailMessage"("userId", "folder");

ALTER TABLE "WebmailMessage" ADD CONSTRAINT "WebmailMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebmailMessage" ADD CONSTRAINT "WebmailMessage_smtpAccountId_fkey"
  FOREIGN KEY ("smtpAccountId") REFERENCES "SmtpAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
