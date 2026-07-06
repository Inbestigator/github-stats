import Mustache from "mustache";
import { getGitHubStats } from "./github.ts";

type View = {
  [key: string]: string | undefined | View;
};

type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string | undefined
    ? `${Prefix}${K}`
    : T[K] extends object
      ? DotPaths<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type VariableKey = DotPaths<ReturnType<typeof generateView>>;

export const titles: Record<VariableKey, string> = {
  "user.name": "Username",
  "user.login": "Login",
  "user.bio": "Bio",
  "user.avatarUrl": "Avatar",
  "user.followers": "Followers",
  "user.following": "Following",
  "user.contributions": "Contributions this year",
  "user.repos": "Repositories",
  "user.createdAt": "Created account",
  "repos.stars": "Stars",
  "repos.mostStarred": "Most starred",
  "repos.forks": "Forks",
  "repos.watchers": "Watchers",
  "repos.averageStars": "Average star count",
  "repos.active": "Active repositories",
  "repos.topLanguage": "Favourite language",
  "repos.languages": "Languages used",
};

export function generateView(stats: Stats) {
  return {
    user: {
      name: stats.github.name || undefined,
      login: stats.github.login,
      bio: stats.github.bio || undefined,
      avatarUrl: stats.github.avatarUrl || undefined,
      followers: stats.github.followers.toLocaleString(),
      following: stats.github.following.toLocaleString(),
      contributions: stats.github.contributions.toLocaleString(),
      repos: stats.github.repositories.toLocaleString(),
      createdAt: stats.github.createdAt,
    },
    repos: {
      stars: stats.github.stars.toLocaleString(),
      mostStarred: stats.github.highestStarRepo,
      forks: stats.github.forks.toLocaleString(),
      watchers: stats.github.watchers.toLocaleString(),
      averageStars: stats.github.averageStars.toFixed(1),
      active: stats.github.activeRepos.toLocaleString(),
      topLanguage: stats.github.topLanguage,
      languages: stats.github.languageDiversity.toLocaleString(),
    },
  } satisfies View;
}

export function populateBioLines(bio: string, stats: Stats) {
  const view = generateView(stats);
  return bio.split("\n").map((l) => {
    const v = Mustache.render(l, view);
    return v.length > 100 ? `${v.slice(0, 99)}…` : v || undefined;
  }) as [string?, string?, string?];
}

export function titleToValue(variable: VariableKey, stats: Stats) {
  return Mustache.render(`{{${variable}}}`, generateView(stats)) || undefined;
}

export type Stats = { github: Awaited<ReturnType<typeof getGitHubStats>> };

export async function getStats(login: string, token: string, stats: VariableKey[]): Promise<Stats> {
  return { github: await getGitHubStats(login, token, stats) };
}
