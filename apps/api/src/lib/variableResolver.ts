import { encryptSecret, decryptSecret } from './secretsVault';
import { env } from '../env';

export interface RawVariableInput {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface ResolvedVariablesResult {
  resolved: Record<string, string>;
  references: Record<string, string>;
  hasErrors: boolean;
  errors: string[];
}

/**
 * Parses and resolves reference variables in format `${{TargetName.KEY_NAME}}`
 * Example: `${{Postgres.DATABASE_URL}}` -> `postgres://postgres:secret@postgres-service:5432/main`
 */
export function resolveVariableReferences(
  variables: RawVariableInput[],
  contextMap: Record<string, Record<string, string>> = {}
): ResolvedVariablesResult {
  const result: Record<string, string> = {};
  const references: Record<string, string> = {};
  const errors: string[] = [];
  let hasErrors = false;

  const rawMap: Record<string, string> = {};
  for (const v of variables) {
    rawMap[v.key] = v.value;
  }

  // Expression regex matching ${{TargetName.VAR_NAME}} or ${{VAR_NAME}}
  const refRegex = /\$\{\{\s*([a-zA-Z0-9_\-]+(?:\.[a-zA-Z0-9_\-]+)?)\s*\}\}/g;

  function resolveValue(key: string, currentVal: string, visited: Set<string>): string {
    if (visited.has(key)) {
      hasErrors = true;
      errors.push(`Cyclic reference detected for variable: ${key}`);
      return currentVal;
    }

    visited.add(key);

    return currentVal.replace(refRegex, (match, path) => {
      references[key] = path;
      const parts = path.split('.');

      if (parts.length === 1) {
        // Local variable reference: ${{OTHER_LOCAL_VAR}}
        const localTarget = parts[0];
        if (rawMap[localTarget] !== undefined) {
          return resolveValue(localTarget, rawMap[localTarget], new Set(visited));
        }
      } else if (parts.length === 2) {
        // Cross-service/DB reference: ${{Postgres.DATABASE_URL}}
        const [targetService, targetKey] = parts;
        if (contextMap[targetService] && contextMap[targetService][targetKey] !== undefined) {
          return contextMap[targetService][targetKey];
        }
      }

      // If reference cannot be resolved yet, leave template placeholder intact
      return match;
    });
  }

  for (const v of variables) {
    result[v.key] = resolveValue(v.key, v.value, new Set());
  }

  return {
    resolved: result,
    references,
    hasErrors,
    errors,
  };
}

/**
 * Helper to encrypt resolved variable map for database storage
 */
export function encryptVariableMap(varMap: Record<string, string>): string {
  return encryptSecret(JSON.stringify(varMap), env.secretsEncryptionKey);
}

/**
 * Helper to decrypt encrypted variable map from database storage
 */
export function decryptVariableMap(encryptedStr: string): Record<string, string> {
  try {
    const json = decryptSecret(encryptedStr, env.secretsEncryptionKey);
    return JSON.parse(json);
  } catch {
    return {};
  }
}
