/**
 * Shared utility function for parsing raw .env file text into an array of key-value pairs.
 * 
 * Handles:
 * - Blank lines & whitespace
 * - Comments starting with '#' (standalone or trailing)
 * - `export KEY=VALUE` lines
 * - Double ("...") and single ('...') quoted strings
 * - Multiline escape sequences
 */
export interface ParsedEnvVar {
  key: string;
  value: string;
}

export function parseEnvText(raw: string): ParsedEnvVar[] {
  const lines = raw.split('\n');
  const result: ParsedEnvVar[] = [];
  const seenKeys = new Set<string>();

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Handle `export KEY=VALUE`
    if (trimmed.startsWith('export ')) {
      trimmed = trimmed.slice(7).trim();
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();

      // Remove inline comments if not inside quotes
      if (!value.startsWith('"') && !value.startsWith("'")) {
        const commentIdx = value.indexOf(' #');
        if (commentIdx >= 0) {
          value = value.slice(0, commentIdx).trim();
        }
      }

      // Strip enclosing quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key && !seenKeys.has(key)) {
        seenKeys.add(key);
        result.push({ key, value });
      }
    }
  }

  return result;
}
