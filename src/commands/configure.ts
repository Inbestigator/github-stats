import abseil from "abseil";
import {
  ActionRow,
  Button,
  type CommandConfig,
  type CommandInteraction,
  Container,
  type MessageComponentInteraction,
  Section,
  SelectMenu,
  SelectMenuOption,
  Separator,
  TextDisplay,
  Thumbnail,
} from "dressed";
import { getUser, getUserConfig, type SyncConfig, type UserRecord } from "../db.ts";
import { populateBioLines, titles, type VariableKey } from "../stats/index.ts";

export const config = {
  description: "Reorder your widget",
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction<typeof config>) {
  const [user, userConfig] = await Promise.all([
    getUser(interaction.user.id),
    getUserConfig(interaction.user.id),
    interaction.deferReply({ ephemeral: true }),
  ]);
  if (!user) return interaction.editReply("Your GitHub account hasn't been linked yet, `/sync` to get started");
  return interaction.editReply({
    components: ConfigPage({
      config: userConfig,
      cached_stats: user.cached_stats ?? DEFAULT_STATS,
      originalConfig: userConfig,
    }),
    flags: ["IsComponentsV2"],
  });
}

const DEFAULT_STATS = {
  github: {
    name: "The Octocat",
    login: "@octocat",
    bio: "",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?u=a59fef2a493e2b67dd13754231daf220c82ba84d&v=4",
    followers: 23183,
    following: 9,
    contributions: 0,
    stars: 21656,
    repositories: 203,
    topLanguage: "HTML",
    highestStarRepo: "Spoon-Knife",
    createdAt: "Jan 25, 2011",
    forks: 165359,
    watchers: 2897,
    averageStars: 2707,
    activeRepos: 0,
    languageDiversity: 3,
  },
  savedAt: Date.now(),
};

export function ConfigPage(
  { config, cached_stats, originalConfig }: ReturnType<typeof getEncodedInfo>,
  selectIndex?: number,
) {
  const [bio1, bio2, bio3] = populateBioLines(config.bio, cached_stats);
  return [
    Container(
      TextDisplay(
        `<:${encodeEmoji(JSON.stringify({ config, cached_stats, originalConfig }))}:1523487044805066782> GitHub Stats`,
      ),
      Section(
        [bio1 ? `## ${bio1}` : "⠀", bio2, bio3].filter(Boolean) as string[],
        Thumbnail(config.avatar ? cached_stats.github.avatarUrl : process.env.ASSET_GH_ICON_URL!),
      ),
      ...chunk(config.stats, 3).map((row, rowIndex) =>
        ActionRow(
          ...(selectIndex !== undefined && rowIndex === Math.floor(selectIndex / 3)
            ? [
                SelectMenu({
                  type: "String",
                  custom_id: `config-stat-select-${selectIndex}`,
                  options: Object.entries(titles)
                    .filter(([k]) => !config.stats.includes(k as VariableKey))
                    .map(([k, v]) => SelectMenuOption(v, k)),
                  placeholder: `Select the data for slot ${selectIndex + 1}`,
                }),
              ]
            : row.map((stat, i) => StatButton(stat, rowIndex * 3 + i))),
        ),
      ),
      Separator(),
      ActionRow(
        Button({
          custom_id: "config-avatar",
          emoji: { name: config.avatar ? "🔘" : "⚫" },
          label: "Avatar",
          style: "Secondary",
        }),
        Button({ custom_id: "config-bio", label: "Edit bio", style: "Secondary" }),
      ),
    ),
    Section(
      ["-# Saving will not update your widget"],
      Button({
        custom_id: "config-save",
        label: "Save",
        disabled: JSON.stringify(config) === JSON.stringify(originalConfig),
      }),
    ),
  ];
}

function encodeEmoji(input: string) {
  return Array.from(input)
    .map((char) => {
      if (/^[A-Za-z0-9]$/.test(char)) return char;
      return `_${char.codePointAt(0)?.toString(16).padStart(6, "0")}`;
    })
    .join("");
}

function decodeEmoji(input: string) {
  return input.replace(/_([0-9a-fA-F]{6})/g, (_, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    return String.fromCodePoint(codePoint);
  });
}

function StatButton(stat: VariableKey | undefined, index: number) {
  return Button({
    custom_id: `config-stat-${index}`,
    label: stat ? titles[stat] : "Empty slot",
    style: "Secondary",
  });
}

export function getEncodedInfo(message: MessageComponentInteraction["message"]): {
  config: SyncConfig;
  cached_stats: NonNullable<UserRecord["cached_stats"]>;
  originalConfig: SyncConfig;
} {
  return JSON.parse(
    decodeEmoji(
      /:(.+):/.exec(
        abseil(message.components ?? [])
          .initial("Container")
          .child("TextDisplay").value.content,
      )?.[1] ?? "",
    ),
  );
}

const chunk = <T>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
