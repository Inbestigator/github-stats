import { createClient } from "@libsql/client";
import type { getGitHubStats } from "./stats.ts";
import type { statDefinitions } from "./sync.ts";

export const libsql = createClient({
  url: process.env.DB_URL ?? "file:local.db",
  authToken: process.env.DB_AUTH_TOKEN,
});

export interface UserRecord {
  discord_id: string;
  github_login: string;
  github_token: string;
  profile:
    | (Pick<Awaited<ReturnType<typeof getGitHubStats>>, "name" | "login" | "bio" | "avatarUrl"> & { savedAt: number })
    | null;
}

export interface PendingInitRecord {
  state: string;
  discord_id: string;
  interaction_token: string;
}

export type SyncStatKey = keyof typeof statDefinitions;

export type SyncConfig = (SyncStatKey | undefined)[];

export const DEFAULT_SYNC_STATS: Readonly<SyncConfig> = Object.freeze([
  "followers",
  "following",
  "contributions",
  "stars",
  "repositories",
  "favourite_language",
]);

async function ensureSchema() {
  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS user (
      discord_id TEXT PRIMARY KEY,
      github_login TEXT NOT NULL,
      github_token TEXT NOT NULL,
      profile JSON
    )
  `);

  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS user_config (
      discord_id TEXT PRIMARY KEY,
      stats JSON NOT NULL
    )
  `);

  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS pending_init (
      state TEXT PRIMARY KEY,
      discord_id TEXT,
      interaction_token TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

if (process.env.NODE_ENV === "development") await ensureSchema();

export async function upsertUser(discordId: string, githubLogin: string, githubToken: string) {
  await libsql.execute({
    sql: `
      INSERT INTO user (discord_id, github_login, github_token)
      VALUES (?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        github_login = excluded.github_login,
        github_token = excluded.github_token
    `,
    args: [discordId, githubLogin, githubToken],
  });
}

export async function setCachedProfile(discordId: string, profile: Omit<UserRecord["profile"], "savedAt">) {
  await libsql.execute({
    sql: `UPDATE user SET profile = ? WHERE discord_id = ?`,
    args: [JSON.stringify({ ...profile, savedAt: Date.now() }), discordId],
  });
}

export async function getUser(discordId: string) {
  const result = await libsql.execute({
    sql: `SELECT discord_id, github_login, github_token, profile FROM user WHERE discord_id = ? LIMIT 1`,
    args: [discordId],
  });

  const row = result.rows[0] as unknown as UserRecord | undefined;

  if (row) row.profile = JSON.parse(row.profile as unknown as string);

  return row;
}

export async function deleteUser(discordId: string) {
  await libsql.batch([
    { sql: `DELETE FROM user WHERE discord_id = ?`, args: [discordId] },
    { sql: `DELETE FROM user_config WHERE discord_id = ?`, args: [discordId] },
  ]);
}

function normalizeConfig(stats: unknown): SyncConfig {
  if (!Array.isArray(stats)) {
    return [...DEFAULT_SYNC_STATS];
  }

  const normalized = stats.slice(0, 6) as Array<SyncStatKey | undefined>;
  while (normalized.length < 6) {
    normalized.push(undefined);
  }

  return normalized as SyncConfig;
}

export async function getUserConfig(discordId: string) {
  const result = await libsql.execute({
    sql: `SELECT stats FROM user_config WHERE discord_id = ?`,
    args: [discordId],
  });

  const rawStats = result.rows[0]?.[0];
  if (typeof rawStats !== "string") {
    return [...DEFAULT_SYNC_STATS];
  }

  try {
    const parsed = JSON.parse(rawStats);
    return normalizeConfig(parsed);
  } catch {
    return [...DEFAULT_SYNC_STATS];
  }
}

export async function setUserConfig(discordId: string, stats: SyncConfig) {
  await libsql.execute({
    sql: `
      INSERT INTO user_config (discord_id, stats)
      VALUES (?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET stats = excluded.stats
    `,
    args: [discordId, JSON.stringify(stats)],
  });
}

export async function getPendingInit(state: string) {
  const result = await libsql.execute({
    sql: `SELECT state, discord_id, interaction_token FROM pending_init WHERE state = ? LIMIT 1`,
    args: [state],
  });

  const row = result.rows[0] as unknown as PendingInitRecord | undefined;
  return row;
}

export async function insertPendingInit(state: string, discordId: string, interactionToken: string) {
  await libsql.execute({
    sql: `INSERT INTO pending_init (state, discord_id, interaction_token) VALUES (?, ?, ?)`,
    args: [state, discordId, interactionToken],
  });
}

export async function deletePendingInit(state: string) {
  await libsql.execute({
    sql: `DELETE FROM pending_init WHERE state = ?`,
    args: [state],
  });
}
