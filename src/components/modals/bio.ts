import type { ModalSubmitInteraction } from "dressed";
import { ConfigPage, getEncodedInfo } from "../../commands/configure.ts";
import { DEFAULT_USER_CONFIG } from "../../db.ts";

export const pattern = "config-bio";

export default function (interaction: ModalSubmitInteraction) {
  const info = getEncodedInfo(interaction.message!);

  info.config.bio =
    interaction
      .getField("value", false)
      ?.textInput()
      .split("\n")
      .slice(0, 3)
      .map((l) => (l.length > 100 ? l.slice(0, 101) : l))
      .join("\n") ?? DEFAULT_USER_CONFIG.bio;

  return interaction.update({ components: ConfigPage(info) });
}
