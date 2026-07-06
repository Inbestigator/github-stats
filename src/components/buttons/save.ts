import type { Params } from "@dressed/matcher";
import abseil from "abseil";
import type { MessageComponentInteraction } from "dressed";
import { ConfigPage, patchWidgetTop } from "../../commands/configure.ts";
import { type SyncConfig, setUserConfig } from "../../db.ts";

export const pattern = "save-stats-:selectedStats";

export default async function (interaction: MessageComponentInteraction, props: Params<typeof pattern>) {
  const selectedStats = props.selectedStats.split(",").map((v) => v || undefined) as SyncConfig;

  await setUserConfig(interaction.user.id, selectedStats);

  const components = patchWidgetTop(ConfigPage(selectedStats, true), interaction.message);

  abseil(components).initial("Container").last("Section")?.accessory("Button").update({ label: "Saved" });

  return interaction.update({ components });
}
