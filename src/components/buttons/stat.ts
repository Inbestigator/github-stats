import type { Params } from "@dressed/matcher";
import type { MessageComponentInteraction } from "dressed";
import { ConfigPage, patchWidgetTop } from "../../commands/configure.ts";
import type { SyncConfig } from "../../db.ts";

export const pattern = "stat-:index-:selectedStats";

export default function (interaction: MessageComponentInteraction, props: Params<typeof pattern>) {
  const selectedStats = props.selectedStats.split(",").map((v) => v || undefined) as SyncConfig;
  const index = Number(props.index);
  const curr = selectedStats[index];

  if (curr) selectedStats[index] = undefined;

  return interaction.update({
    components: patchWidgetTop(ConfigPage(selectedStats, undefined, !curr ? index : undefined), interaction.message),
  });
}
