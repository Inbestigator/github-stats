import type { Params } from "@dressed/matcher";
import abseil from "abseil";
import type { MessageComponentInteraction } from "dressed";
import { ConfigPage } from "../../commands/configure.ts";
import { type SyncConfig, setUserConfig } from "../../db.ts";

export const pattern = "save-stats-:selectedStats";

export default async function (interaction: MessageComponentInteraction, props: Params<typeof pattern>) {
  const selectedStats = props.selectedStats.split(",").map((v) => v || undefined) as SyncConfig;
  const components = ConfigPage(selectedStats, true);
  await setUserConfig(interaction.user.id, selectedStats);
  abseil(components).initial("Container").last("ActionRow")?.child("Button").update({ label: "Saved settings" });
  return interaction.update({ components });
}
