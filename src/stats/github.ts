interface RepoNode {
  name: string;
  stargazerCount: number;
  forkCount: number;
  watchers: { totalCount: number };
  createdAt: string;
  pushedAt: string;
  primaryLanguage: { name: string } | null;
}

interface UserQueryResponse {
  data: {
    user: {
      name: string | null;
      login: string;
      bio: string | null;
      avatarUrl: string;
      createdAt: string;
      followers: { totalCount: number };
      following: { totalCount: number };
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
        };
      };
      repositories: {
        totalCount: number;
      };
    } | null;
  };
}

interface RepoQueryResponse {
  data: {
    user: {
      repositories: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: RepoNode[];
      };
    } | null;
  };
}

async function gql<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  if ("errors" in json) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }

  return json;
}

const USER_QUERY = `
  query ($login: String!) {
    user(login: $login) {
      name
      login
      bio
      avatarUrl
      createdAt

      followers { totalCount }
      following { totalCount }

      contributionsCollection {
        contributionCalendar {
          totalContributions
        }
      }

      repositories {
        totalCount
      }
    }
  }
`;

const REPOS_QUERY = `
  query ($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }

        nodes {
          name
          stargazerCount
          forkCount
          createdAt
          pushedAt

          watchers { totalCount }

          primaryLanguage {
            name
          }
        }
      }
    }
  }
`;

async function fetchUserData(login: string, token: string) {
  const userJson = await gql<UserQueryResponse>(USER_QUERY, { login }, token);
  const user = userJson.data.user;
  if (!user) throw new Error("User not found");
  return user;
}

async function fetchRepoData(login: string, token: string) {
  const repos: RepoNode[] = [];
  let cursor: string | null = null;

  while (true) {
    const repoJson = (await gql(REPOS_QUERY, { login, cursor }, token)) as RepoQueryResponse;
    const repoData = repoJson.data.user?.repositories;
    if (!repoData) break;

    repos.push(...repoData.nodes);

    if (!repoData.pageInfo.hasNextPage) break;
    cursor = repoData.pageInfo.endCursor;
  }

  return repos;
}

function totalStars(repos: RepoNode[]) {
  return repos.reduce((sum, r) => sum + r.stargazerCount, 0);
}

function totalForks(repos: RepoNode[]) {
  return repos.reduce((sum, r) => sum + r.forkCount, 0);
}

function totalWatchers(repos: RepoNode[]) {
  return repos.reduce((sum, r) => sum + r.watchers.totalCount, 0);
}

function avgStarsPerRepo(repos: RepoNode[]) {
  return repos.length ? totalStars(repos) / repos.length : 0;
}

function activeRepos(repos: RepoNode[]) {
  const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 180;
  return repos.filter((r) => new Date(r.pushedAt).getTime() > cutoff).length;
}

function createdAt(createdAt: string) {
  return new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function topLanguage(repos: RepoNode[]) {
  const counts = new Map<string, number>();

  for (const repo of repos) {
    const lang = repo.primaryLanguage?.name;

    if (!lang) continue;

    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function languageDiversity(repos: RepoNode[]) {
  return new Set(repos.map((r) => r.primaryLanguage?.name).filter(Boolean)).size;
}

function highestStarRepo(repos: RepoNode[]) {
  return repos.reduce<RepoNode | undefined>((best, repo) => {
    if (!best || repo.stargazerCount > best.stargazerCount) {
      return repo;
    }
    return best;
  }, undefined)?.name;
}

export async function getGitHubStats(login: string, token: string, include: string[]) {
  const [user, repos] = await Promise.all([
    fetchUserData(login, token),
    include.some((s) => s.startsWith("repos.")) ? fetchRepoData(login, token) : [],
  ]);
  return {
    name: user.name,
    login: `@${user.login}`,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    followers: user.followers.totalCount,
    following: user.following.totalCount,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    repositories: user.repositories.totalCount,
    createdAt: createdAt(user.createdAt),

    stars: totalStars(repos),
    highestStarRepo: highestStarRepo(repos),
    forks: totalForks(repos),
    watchers: totalWatchers(repos),
    averageStars: avgStarsPerRepo(repos),
    activeRepos: activeRepos(repos),
    topLanguage: topLanguage(repos),
    languageDiversity: languageDiversity(repos),
  };
}
