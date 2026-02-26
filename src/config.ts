import fs from 'fs';
import os from 'os';
import path from 'path';

import { readEnvFile } from './env.js';

// Read config values from .env (falls back to process.env).
// Secrets are NOT read here — they stay on disk and are loaded only
// where needed (container-runner.ts) to avoid leaking to child processes.
const envConfig = readEnvFile(['ASSISTANT_NAME', 'ASSISTANT_HAS_OWN_NUMBER', 'TRIGGER_ALIASES']);

export const ASSISTANT_NAME =
  process.env.ASSISTANT_NAME || envConfig.ASSISTANT_NAME || 'Andy';
export const ASSISTANT_HAS_OWN_NUMBER =
  (process.env.ASSISTANT_HAS_OWN_NUMBER ||
    envConfig.ASSISTANT_HAS_OWN_NUMBER) === 'true';
export const POLL_INTERVAL = 2000;
export const SCHEDULER_POLL_INTERVAL = 60000;

// Absolute paths needed for container mounts
const PROJECT_ROOT = process.cwd();
const HOME_DIR = process.env.HOME || os.homedir();

// Mount security: allowlist stored OUTSIDE project root, never mounted into containers
export const MOUNT_ALLOWLIST_PATH = path.join(
  HOME_DIR,
  '.config',
  'nanoclaw',
  'mount-allowlist.json',
);
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');
export const GROUPS_DIR = path.resolve(PROJECT_ROOT, 'groups');
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
export const MAIN_GROUP_FOLDER = 'main';

export const CONTAINER_IMAGE =
  process.env.CONTAINER_IMAGE || 'nanoclaw-agent:latest';
export const CONTAINER_TIMEOUT = parseInt(
  process.env.CONTAINER_TIMEOUT || '1800000',
  10,
);
export const CONTAINER_MAX_OUTPUT_SIZE = parseInt(
  process.env.CONTAINER_MAX_OUTPUT_SIZE || '10485760',
  10,
); // 10MB default
export const IPC_POLL_INTERVAL = 1000;
export const IDLE_TIMEOUT = parseInt(process.env.IDLE_TIMEOUT || '1800000', 10); // 30min default — how long to keep container alive after last result
export const MAX_CONCURRENT_CONTAINERS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_CONTAINERS || '5', 10) || 5,
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Additional trigger names (comma-separated), e.g. TRIGGER_ALIASES=Claude,Bot
const triggerAliases = (process.env.TRIGGER_ALIASES || envConfig.TRIGGER_ALIASES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allTriggerNames = [ASSISTANT_NAME, ...triggerAliases];

export const TRIGGER_PATTERN = new RegExp(
  `^@(${allTriggerNames.map(escapeRegex).join('|')})\\b`,
  'i',
);

// Timezone for scheduled tasks (cron expressions, etc.)
// Uses system timezone by default
export const TIMEZONE =
  process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

const MCP_CONFIG_PATH = path.resolve(PROJECT_ROOT, '.mcp.json');

/**
 * Read user-configured MCP servers from .mcp.json at project root.
 * Returns undefined if file is missing, invalid, or empty.
 * Rejects 'nanoclaw' as a user-defined server name to prevent overriding the built-in IPC server.
 */
export function readMcpConfig(): Record<string, Record<string, unknown>> | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf-8'));
    const servers = raw?.mcpServers;
    if (servers && typeof servers === 'object' && Object.keys(servers).length > 0) {
      if ('nanoclaw' in servers) {
        delete servers.nanoclaw;
      }
      return Object.keys(servers).length > 0 ? servers : undefined;
    }
  } catch { /* file missing or invalid — no user MCP servers */ }
  return undefined;
}
