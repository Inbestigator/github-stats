import type { Params } from "@dressed/matcher";
import type { MessageComponentInteraction } from "dressed";
import { ConfigPage, getEncodedInfo } from "../../commands/configure.ts";
import type { VariableKey } from "../../stats/index.ts";

export const pattern = "config-stat-select-:index";

export default function (interaction: MessageComponentInteraction<"StringSelect">, props: Params<typeof pattern>) {
  const info = getEncodedInfo(interaction.message);
  const index = Number(props.index);

  info.config.stats[index] = interaction.values[0] as VariableKey;

  return interaction.update({ components: ConfigPage(info) });
}
