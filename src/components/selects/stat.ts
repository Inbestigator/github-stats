import type { Params } from "@dressed/matcher";
import type { MessageComponentInteraction } from "dressed";
import { ConfigPage, patchWidgetTop } from "../../commands/configure.ts";
import type { SyncConfig, SyncStatKey } from "../../db.ts";

export const pattern = "stat-select-:index-:selectedStats";

export default function (interaction: MessageComponentInteraction<"StringSelect">, props: Params<typeof pattern>) {
  const selectedStats = props.selectedStats.split(",").map((v) => v || undefined) as SyncConfig;
  const index = Number(props.index);

  selectedStats[index] = interaction.values[0] as SyncStatKey;

  return interaction.update({ components: patchWidgetTop(ConfigPage(selectedStats), interaction.message) });
}
