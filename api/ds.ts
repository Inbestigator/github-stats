import { editWebhookMessage } from "dressed";
import { botEnv } from "dressed/utils";
import { LinkPage } from "../src/commands/sync.ts";
import { getPendingInit } from "../src/db.ts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");

  if (state) {
    const pendingInit = await getPendingInit(state);
    if (pendingInit) {
      await editWebhookMessage(
        botEnv.DISCORD_APP_ID,
        pendingInit.interaction_token,
        "@original",
        LinkPage(pendingInit.state, 2),
      );
      return Response.redirect("https://stat-widget.vercel.app/success.html");
    }
  }

  return Response.redirect(
    `https://stat-widget.vercel.app/error.html?m=${encodeURIComponent("Your session has expired. Please run `/sync` to try again")}`,
  );
}
