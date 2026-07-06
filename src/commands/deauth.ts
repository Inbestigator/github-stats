import type { CommandConfig, CommandInteraction } from "dressed";
import { deleteUser, getUser } from "../db.ts";

export const config = {
  description: "Deletes your user data and revokes the GitHub token",
} satisfies CommandConfig;

export default async function (interaction: CommandInteraction<typeof config>) {
  const [user] = await Promise.all([getUser(interaction.user.id), interaction.deferReply({ ephemeral: true })]);

  if (!user?.github_token) {
    return interaction.editReply("Your GitHub account hasn't been linked yet");
  }

  const res = await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${Buffer.from(
        `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`,
      ).toString("base64")}`,
    },
    body: JSON.stringify({ access_token: user.github_token }),
  });

  await deleteUser(interaction.user.id);

  return interaction.editReply(
    `You've been removed ${res.ok ? "and the GitHub token was" : "but the GitHub token wasn't"} revoked`,
  );
}
