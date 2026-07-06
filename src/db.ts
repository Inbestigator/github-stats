import { createClient } from "@libsql/client";
import type { Stats, VariableKey } from "./stats/index.ts";

export const libsql = createClient({
  url: process.env.DB_URL ?? "file:local.db",
  authToken: process.env.DB_AUTH_TOKEN,
});

export interface UserRecord {
  discord_id: string;
  github_login: string;
  github_token: string;
  cached_stats: (Stats & { savedAt: number }) | null;
}

export interface PendingInitRecord {
  state: string;
  discord_id: string;
  interaction_token: string;
}

export interface SyncConfig {
  stats: (VariableKey | undefined)[];
  avatar: boolean;
  bio: string;
}

export const DEFAULT_USER_CONFIG = Object.freeze({
  stats: ["user.followers", "user.following", "user.contributions", "repos.stars", "repos.count", "user.topLanguage"],
  avatar: true,
  bio: "{{user.name}}\n{{user.bio}}\n{{user.login}}",
} satisfies SyncConfig);

async function ensureSchema() {
  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS user (
      discord_id TEXT PRIMARY KEY,
      github_login TEXT NOT NULL,
      github_token TEXT NOT NULL,
      cached_stats JSON
    )
  `);

  await libsql.execute(`
    CREATE TABLE IF NOT EXISTS user_config (
      discord_id TEXT PRIMARY KEY,
      stats JSON NOT NULL,
      avatar INTEGER NOT NULL,
      bio TEXT NOT NULL
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

export async function setCachedStats(discordId: string, cachedStats: Omit<UserRecord["cached_stats"], "savedAt">) {
  await libsql.execute({
    sql: `UPDATE user SET cached_stats = ? WHERE discord_id = ?`,
    args: [JSON.stringify({ ...cachedStats, savedAt: Date.now() }), discordId],
  });
}

export async function getUser(discordId: string) {
  const result = await libsql.execute({
    sql: `SELECT discord_id, github_login, github_token, cached_stats FROM user WHERE discord_id = ? LIMIT 1`,
    args: [discordId],
  });

  const row = result.rows[0] as unknown as UserRecord | undefined;

  if (row) row.cached_stats = JSON.parse(row.cached_stats as unknown as string);

  return row;
}

export async function deleteUser(discordId: string) {
  await libsql.batch([
    { sql: `DELETE FROM user WHERE discord_id = ?`, args: [discordId] },
    { sql: `DELETE FROM user_config WHERE discord_id = ?`, args: [discordId] },
  ]);
}

function normalizeConfig(config: unknown): SyncConfig {
  if (typeof config === "object" && config !== null && "stats" in config && Array.isArray(config.stats)) {
    const normalized = config.stats.slice(0, 6) as SyncConfig["stats"];

    while (normalized.length < 6) {
      normalized.push(undefined);
    }

    return {
      stats: normalized,
      avatar:
        "avatar" in config && typeof config.avatar === "number" ? Boolean(config.avatar) : DEFAULT_USER_CONFIG.avatar,
      bio: "bio" in config && typeof config.bio === "string" ? config.bio : DEFAULT_USER_CONFIG.bio,
    };
  }

  return { ...DEFAULT_USER_CONFIG };
}

export async function getUserConfig(discordId: string) {
  const result = await libsql.execute({
    sql: `SELECT stats, avatar, bio FROM user_config WHERE discord_id = ?`,
    args: [discordId],
  });

  const row = result.rows[0] as unknown as SyncConfig | undefined;

  if (row) row.stats = JSON.parse(row.stats as unknown as string);

  try {
    return normalizeConfig(row);
  } catch {
    return { ...DEFAULT_USER_CONFIG };
  }
}

export async function setUserConfig(discordId: string, { avatar, stats, bio }: SyncConfig) {
  await libsql.execute({
    sql: `
      INSERT INTO user_config (discord_id, stats, avatar, bio)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        stats = excluded.stats,
        avatar = excluded.avatar,
        bio = excluded.bio
    `,
    args: [discordId, JSON.stringify(stats), Number(avatar), bio],
  });
}

export async function getPendingInit(state: string) {
  const result = await libsql.execute({
    sql: `SELECT state, discord_id, interaction_token FROM pending_init WHERE state = ? LIMIT 1`,
    args: [state],
  });
  return result.rows[0] as unknown as PendingInitRecord | undefined;
}

export async function insertPendingInit(state: string, discordId: string, interactionToken: string) {
  await libsql.execute({
    sql: `INSERT INTO pending_init (state, discord_id, interaction_token) VALUES (?, ?, ?)`,
    args: [state, discordId, interactionToken],
  });
}

export async function deletePendingInit(state: string) {
  const result = await libsql.execute({ sql: `DELETE FROM pending_init WHERE state = ? RETURNING *`, args: [state] });
  return result.rows[0] as unknown as PendingInitRecord | undefined;
}
