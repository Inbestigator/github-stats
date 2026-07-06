import { botEnv, callDiscord } from "dressed/utils";
import Mustache from "mustache";
import { DEFAULT_USER_CONFIG, type SyncConfig, setCachedStats } from "./db.ts";
import { getGitHubStats } from "./stats.ts";

export const statDefinitions = {
  fs: { title: "Followers", value: (data) => data.followers.toLocaleString() },
  fg: { title: "Following", value: (data) => data.following.toLocaleString() },
  cb: { title: "Contributions this year", value: (data) => data.contributions.toLocaleString() },
  ca: { title: "Created account", value: (data) => data.createdAt },
  s: { title: "Stars", value: (data) => data.stars.toLocaleString() },
  as: { title: "Average star count", value: (data) => data.averageStars.toFixed(1) },
  f: { title: "Forks", value: (data) => data.forks.toLocaleString() },
  w: { title: "Watchers", value: (data) => data.watchers.toLocaleString() },
  r: { title: "Repositories", value: (data) => data.repositories.toLocaleString() },
  ar: { title: "Active repositories", value: (data) => data.activeRepos.toLocaleString() },
  ms: { title: "Most starred", value: (data) => data.highestStarRepo },
  l: { title: "Languages used", value: (data) => data.languageDiversity.toLocaleString() },
  fl: { title: "Favourite language", value: (data) => data.topLanguage },
} satisfies Record<
  string,
  { title: string; value: (data: Awaited<ReturnType<typeof getGitHubStats>>) => string | undefined }
>;

export function populateBioLines(bio: string, stats: Awaited<ReturnType<typeof getGitHubStats>>) {
  const view = {
    user: {
      name: stats.name,
      login: stats.login,
      bio: stats.bio,
      avatarUrl: stats.avatarUrl,
      followers: stats.followers,
      following: stats.following,
      contributions: stats.contributions,
      topLanguage: stats.topLanguage,
      createdAt: stats.createdAt,
    },
    repos: {
      count: stats.repositories,
      stars: stats.stars,
      mostStarred: stats.highestStarRepo,
      forks: stats.forks,
      watchers: stats.watchers,
      averageStars: stats.averageStars,
      activeRepos: stats.activeRepos,
      languageDiversity: stats.languageDiversity,
    },
  };
  return bio.split("\n").map((l) => {
    const v = Mustache.render(l, view);
    return v.length > 100 ? `${v.slice(0, 99)}…` : v || undefined;
  }) as [string?, string?, string?];
}

export default async function sync(
  userId: string,
  login: string,
  token: string,
  config: SyncConfig = { ...DEFAULT_USER_CONFIG },
  updateCache?: boolean,
) {
  const data = await getGitHubStats(login, token);
  const dynamic: { type: number; name: string; value: string | number }[] = [
    { type: 1, name: "login", value: data.login },
  ];

  if (config.avatar) {
    dynamic.push({ type: 3, name: "avatar", value: { url: data.avatarUrl } as never });
  }

  populateBioLines(config.bio, data).map((l, i) => l && dynamic.push({ type: 1, name: `bio-${i + 1}`, value: l }));

  for (const [index, stat] of config.stats.entries()) {
    if (!stat) continue;

    const definition = statDefinitions[stat];
    dynamic.push({ type: 1, name: `stat${index + 1}-label`, value: definition.title });
    const value = definition.value(data);
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
