import {
  ActionRow,
  Button,
  type CommandConfig,
  type CommandInteraction,
  Container,
  Section,
  SelectMenu,
  SelectMenuOption,
} from "dressed";
import { getUser, getUserConfig, type SyncConfig, type SyncStatKey } from "../db.ts";
import { statDefinitions } from "../sync.ts";

export const config = {
  description: "Reorder your widget",
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction<typeof config>) {
  const [user, selectedStats] = await Promise.all([
    getUser(interaction.user.id),
    getUserConfig(interaction.user.id),
    interaction.deferReply({ ephemeral: true }),
  ]);
  if (!user) {
    return interaction.editReply({
      content: "No linked GitHub account yet, `/sync` to get started.",
    });
  }
  return interaction.editReply({
    components: ConfigPage(selectedStats, true),
    flags: ["IsComponentsV2"],
  });
}

export function ConfigPage(selectedStats: SyncConfig, disableSave?: boolean, selectIndex?: number) {
  return [
    Container(
      ...chunk(selectedStats, 3).map((row, rowIndex) =>
        ActionRow(
          ...(selectIndex !== undefined && rowIndex === Math.floor(selectIndex / 3)
            ? [
                SelectMenu({
                  type: "String",
                  custom_id: `stat-select-${selectIndex}-${selectedStats}`,
                  options: Object.entries(statDefinitions)
                    .filter(([k]) => !selectedStats.includes(k as SyncStatKey))
                    .map(([k, v]) => SelectMenuOption(v.title, k)),
                  placeholder: `Select the data for slot ${selectIndex + 1}`,
                }),
              ]
            : row.map((stat, i) => StatButton(stat, rowIndex * 3 + i, selectedStats))),
        ),
      ),
    ),
    Section(
      ["-# Saving will not update your widget, you have to run `/sync` for your changes to appear"],
      Button({
        custom_id: `save-stats-${selectedStats}`,
        label: "Save",
        disabled: disableSave,
      }),
    ),
  ];
}

function StatButton(stat: SyncStatKey | undefined, index: number, selectedStats: SyncConfig) {
  return Button({
    custom_id: `stat-${index}-${selectedStats}`,
    label: stat ? statDefinitions[stat].title : "Empty slot",
    style: "Secondary",
  });
}

const chunk = <T>(arr: T[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
