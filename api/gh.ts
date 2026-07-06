import { editWebhookMessage } from "dressed";
import { botEnv } from "dressed/utils";
import { LinkPage } from "../src/commands/sync.ts";
import { deletePendingInit, getPendingInit, upsertUser } from "../src/db.ts";
import sync from "../src/sync.ts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (code && state) {
    const [res, pendingInit] = await Promise.all([
      fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }),
      getPendingInit(state),
    ]);

    if (res.ok && pendingInit) {
      const { access_token } = (await res.json()) as { access_token: string };
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const userData = (await userRes.json()) as { login: string };
      if (userRes.ok) {
        const [upsertRes] = await Promise.allSettled([
          upsertUser(pendingInit.discord_id, userData.login, access_token).then(() =>
            sync(pendingInit.discord_id, userData.login, access_token, undefined, true),
          ),
          deletePendingInit(state),
          editWebhookMessage(
            botEnv.DISCORD_APP_ID,
            pendingInit.interaction_token,
            "@original",
            LinkPage(pendingInit.state, 3),
          ),
        ]);
        if (upsertRes.status === "rejected") {
          return Response.redirect(
            `https://stat-widget.vercel.app/error.html?m=${encodeURIComponent("There was an error saving your details or syncing your stats. Please try again")}`,
          );
        }
        return Response.redirect("https://stat-widget.vercel.app/success.html");
      }
    } else if (pendingInit) {
      await deletePendingInit(state);
      return Response.redirect(
        `https://stat-widget.vercel.app/error.html?m=${encodeURIComponent("There was an error fetching your access token. Please run `/sync` to try again")}`,
      );
    }
  }

  return Response.redirect(
    `https://stat-widget.vercel.app/error.html?m=${encodeURIComponent("Your session has expired. Please run `/sync` to try again")}`,
  );
}
