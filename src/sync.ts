import { botEnv, callDiscord } from "dressed/utils";
import { DEFAULT_USER_CONFIG, type SyncConfig, setCachedStats } from "./db.ts";
import { getStats, populateBioLines, titles, titleToValue } from "./stats/index.ts";

export default async function sync(
  userId: string,
  login: string,
  token: string,
  config: SyncConfig = { ...DEFAULT_USER_CONFIG },
  updateCache?: boolean,
) {
  const data = await getStats(login, token);
  const dynamic: { type: number; name: string; value: string | number }[] = [
    { type: 1, name: "login", value: data.github.login },
  ];

  if (config.avatar) {
    dynamic.push({ type: 3, name: "avatar", value: { url: data.github.avatarUrl } as never });
  }

  populateBioLines(config.bio, data).map((l, i) => l && dynamic.push({ type: 1, name: `bio-${i + 1}`, value: l }));

  for (const [index, variable] of config.stats.entries()) {
    if (!variable) continue;
    dynamic.push({ type: 1, name: `stat${index + 1}-label`, value: titles[variable] });
    const value = titleToValue(variable, data);
    if (value) {
      dynamic.push({ name: `stat${index + 1}-value`, type: 1, value });
    }
  }

  await Promise.all([
    callDiscord(`/applications/${botEnv.DISCORD_APP_ID}/users/${userId}/identities/0/profile`, {
      method: "PATCH",
      body: { data: { dynamic } },
    }),
    updateCache && setCachedStats(userId, data),
  ]);
}
