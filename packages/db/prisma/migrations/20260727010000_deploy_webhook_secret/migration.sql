-- Git-push -> auto-redeploy: per-deployment webhook secret.
ALTER TABLE "Deployment" ADD COLUMN "deployWebhookSecret" TEXT;
CREATE UNIQUE INDEX "Deployment_deployWebhookSecret_key" ON "Deployment"("deployWebhookSecret");
