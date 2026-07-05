import { botEnv, callDiscord } from "dressed/utils";
import { DEFAULT_SYNC_STATS, type SyncConfig } from "./db.ts";
import { getGitHubStats } from "./stats.ts";

export const statDefinitions = {
  followers: { title: "Followers", value: (data) => data.followers.toLocaleString() },
  following: { title: "Following", value: (data) => data.following.toLocaleString() },
  contributions: { title: "Contributions this year", value: (data) => data.contributions.toLocaleString() },
  created_at: { title: "Created account", value: (data) => data.createdAt },
  stars: { title: "Stars", value: (data) => data.stars.toLocaleString() },
  average_stars: { title: "Average star count", value: (data) => data.averageStars.toFixed(1) },
  forks: { title: "Forks", value: (data) => data.createdAt },
  watchers: { title: "Watchers", value: (data) => data.createdAt },
  repositories: { title: "Repositories", value: (data) => data.repositories.toLocaleString() },
  active_repos: { title: "Active repositories", value: (data) => data.activeRepos.toLocaleString() },
  most_starred: { title: "Most starred", value: (data) => data.highestStarRepo },
  languages: { title: "Used languages", value: (data) => data.languageDiversity.toLocaleString() },
  favourite_language: { title: "Favourite language", value: (data) => data.topLanguage },
} satisfies Record<
  string,
  { title: string; value: (data: Awaited<ReturnType<typeof getGitHubStats>>) => string | undefined }
>;

export default async function sync(
  userId: string,
  login: string,
  token: string,
  selectedStats: SyncConfig = [...DEFAULT_SYNC_STATS],
) {
  const data = await getGitHubStats(login, token);
  const dynamic: { type: number; name: string; value: string | number }[] = [
    { type: 1, name: "login", value: data.login },
  ];

  if (data.name) {
    dynamic.push({ type: 1, name: "name", value: data.name });
  }

  if (data.bio) {
    dynamic.push({ type: 1, name: "bio", value: data.bio });
  }

  for (const [index, stat] of selectedStats.entries()) {
    if (!stat) continue;

    const definition = statDefinitions[stat];
    dynamic.push({
      type: 1,
      name: `stat${index + 1}-label`,
      value: definition.title,
    });
    const value = definition.value(data);
    if (value) {
      dynamic.push({
        name: `stat${index + 1}-value`,
        type: 1,
        value,
      });
    }
  }

  await callDiscord(`/applications/${botEnv.DISCORD_APP_ID}/users/${userId}/identities/0/profile`, {
    method: "PATCH",
    body: { data: { dynamic } },
  });
}
