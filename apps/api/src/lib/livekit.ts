import crypto from 'crypto';
import { AccessToken } from 'livekit-server-sdk';

/**
 * Generates a new API key/secret pair for a LiveKit project. Self-hosted
 * (open-source) LiveKit authenticates against a static list of key/secret
 * pairs in its own config — there's no REST endpoint to create a key
 * dynamically, so this just generates the values; getting them INTO the
 * running LiveKit server is the node-agent's job (see
 * services/node-agent/src/livekit.js), which updates the config and
 * restarts the container.
 */
export function generateLiveKitKeyPair(): { apiKey: string; apiSecret: string } {
  return {
    apiKey: `lk_${crypto.randomBytes(8).toString('hex')}`,
    apiSecret: crypto.randomBytes(32).toString('base64url'),
  };
}

interface TokenParams {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  identity: string;
  /** Defaults to a participant who can publish + subscribe. */
  canPublish?: boolean;
  canSubscribe?: boolean;
  ttlSeconds?: number;
}

/** Issues a signed JWT a client can use to join a specific LiveKit room. */
export async function createRoomAccessToken(params: TokenParams): Promise<string> {
  const {
    apiKey,
    apiSecret,
    roomName,
    identity,
    canPublish = true,
    canSubscribe = true,
    ttlSeconds = 60 * 60, // 1 hour
  } = params;

  const token = new AccessToken(apiKey, apiSecret, { identity, ttl: ttlSeconds });
  token.addGrant({ room: roomName, roomJoin: true, canPublish, canSubscribe });

  return token.toJwt();
}
