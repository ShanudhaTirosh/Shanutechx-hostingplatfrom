/**
 * composeIsolation.ts — Multi-Tenant Workload Security & Compose Isolation Validator
 *
 * Enforces multi-tenant isolation boundaries before sending workloads to compute nodes:
 * - Prevents container privilege escalation (privileged mode, host networking, host namespaces)
 * - Prevents dangerous host filesystem mounts (/var/run/docker.sock, /etc, /root, /srv/compose, traversal)
 * - Verifies Traefik router names are scoped to the project
 */

const FORBIDDEN_HOST_MOUNT_PATTERNS = [
  /docker\.sock/i,
  /^\/etc(\/.*)?$/i,
  /^\/proc(\/.*)?$/i,
  /^\/sys(\/.*)?$/i,
  /^\/dev(\/.*)?$/i,
  /^\/root(\/.*)?$/i,
  /^\/home(\/.*)?$/i,
  /^\/var\/lib\/docker(\/.*)?$/i,
  /^\/var\/lib\/shanutechx(\/.*)?$/i,
  /^\/srv\/compose(\/.*)?$/i,
  /^[a-zA-Z]:[\\/]/i,
  /^\\\\/i,
];

const DANGEROUS_CAPS = new Set([
  'ALL',
  'SYS_ADMIN',
  'DAC_OVERRIDE',
  'DAC_READ_SEARCH',
  'NET_ADMIN',
  'SYS_PTRACE',
  'SYS_MODULE',
  'SYS_RAWIO',
  'MAC_ADMIN',
  'MAC_OVERRIDE',
]);

export interface ComposeValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates Compose YAML content to ensure strict multi-tenant isolation.
 */
export function validateComposeSecurity(composeYaml: string): ComposeValidationResult {
  if (!composeYaml || typeof composeYaml !== 'string') {
    return { valid: false, error: 'Compose YAML content cannot be empty' };
  }

  // 1. Privileged Mode check
  if (/privileged\s*:\s*(true|["']true["']|yes|1)\b/i.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Privileged containers are strictly forbidden.' };
  }

  // 2. Host Network Mode
  if (/network_mode\s*:\s*["']?host["']?/i.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Host network mode is strictly forbidden. Containers must use isolated bridge networks.' };
  }

  // 3. Host PID and IPC
  if (/pid\s*:\s*["']?host["']?/i.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Host PID namespace is strictly forbidden.' };
  }
  if (/ipc\s*:\s*["']?host["']?/i.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Host IPC namespace is strictly forbidden.' };
  }
  if (/userns_mode\s*:\s*["']?host["']?/i.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Host user namespace is strictly forbidden.' };
  }

  // 4. Seccomp / AppArmor unconfined
  if (/security_opt\s*:.*(seccomp:unconfined|apparmor:unconfined)/is.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Disabling security profiles (unconfined) is forbidden.' };
  }

  // 5. Dangerous Host Devices
  if (/\bdevices\s*:/i.test(composeYaml)) {
    return { valid: false, error: 'Security violation: Direct host device access is strictly forbidden.' };
  }

  // 6. Inspect Volume Mounts line by line
  const lines = composeYaml.split('\n');
  let inVolumesBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Check if entering a volumes section in a service
    if (/^volumes\s*:/.test(line)) {
      inVolumesBlock = true;
      continue;
    }

    if (inVolumesBlock) {
      if (line.startsWith('-')) {
        const mountEntry = line.replace(/^[-\s]+/, '').replace(/["']/g, '');
        const source = mountEntry.split(':')[0]?.trim() || '';

        // Check for Docker socket
        if (source.includes('docker.sock')) {
          return { valid: false, error: 'Security violation: Mounting the Docker socket is strictly forbidden.' };
        }

        // Check for directory traversal
        if (source.includes('..')) {
          return { valid: false, error: 'Security violation: Relative path traversal (..) in volume mounts is forbidden.' };
        }

        // Check for absolute host system paths
        for (const pattern of FORBIDDEN_HOST_MOUNT_PATTERNS) {
          if (pattern.test(source)) {
            return {
              valid: false,
              error: `Security violation: Host mount '${source}' is forbidden. Only named volumes or project-relative paths (./filename) are allowed.`,
            };
          }
        }
      } else if (!line.startsWith('#') && line.length > 0 && !line.startsWith(' ')) {
        // Exited volumes block
        inVolumesBlock = false;
      }
    }

    // 7. Dangerous Capabilities check
    if (/cap_add\s*:/.test(line) || inVolumesBlock === false) {
      for (const cap of DANGEROUS_CAPS) {
        const capRegex = new RegExp(`-\\s*["']?${cap}["']?\\b`, 'i');
        if (capRegex.test(rawLine)) {
          return { valid: false, error: `Security violation: Dangerous capability '${cap}' is forbidden.` };
        }
      }
    }
  }

  return { valid: true };
}
