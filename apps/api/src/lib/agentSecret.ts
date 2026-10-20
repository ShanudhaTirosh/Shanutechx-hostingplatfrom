import crypto from 'crypto';

/**
 * Per-VPS agent secrets.
 *
 * A customer VPS is a machine the CUSTOMER controls (root), yet the API used to authenticate to its
 * agent with the platform-wide NODE_AGENT_SECRET, sent in clear over plain HTTP. Anyone listening on
 * their own VPS's agent port could capture it and then drive every platform node agent (host-level,
 * Docker socket) - a cross-tenant escalation.
 *
 * With VPS_AGENT_SECRET_MODE=derived the API uses HMAC-SHA256(NODE_AGENT_SECRET, "vps-agent:<id>")
 * for that one VPS instead. A captured value only ever works against the same customer's own VPS, and
 * the platform secret never leaves the control plane. Derivation is one-way, so the VPS cannot go
 * from its secret to the platform secret or to another VPS's secret.
 *
 * The VPS's agent must be (re)started with NODE_AGENT_SECRET set to this derived value:
 *   node -e "const c=require('crypto');console.log(c.createHmac('sha256',process.env.NODE_AGENT_SECRET).update('vps-agent:'+process.argv[1]).digest('hex'))" <vps-provision-id>
 */
export function deriveVpsAgentSecret(provisionId: string, platformSecret: string): string {
  return crypto.createHmac('sha256', platformSecret).update(`vps-agent:${provisionId}`).digest('hex');
}

export function vpsAgentSecretFor(provisionId: string, platformSecret: string, mode: string | undefined): string {
  return mode === 'derived' ? deriveVpsAgentSecret(provisionId, platformSecret) : platformSecret;
}
