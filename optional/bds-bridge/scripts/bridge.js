// Shadowbound AI bridge - Bedrock Dedicated Server only (server-net is not available on phones/PCs).
// Configure in the server's config/<this pack uuid>/variables.json: {"backend_url": "http://127.0.0.1:8787/plan"}
// and secrets.json: {"token": "<same as SHADOWBOUND_TOKEN>"}.
import { system } from "@minecraft/server";
import { http, HttpRequest, HttpRequestMethod, HttpHeader } from "@minecraft/server-net";
import { variables, secrets } from "@minecraft/server-admin";

const url = variables.get("backend_url");

system.runInterval(() => {
  if (url) system.sendScriptEvent("shadowbound:bridge_ready", "1");
}, 600);

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "shadowbound:llm_request" || !url) return;
  let id = "";
  try {
    id = JSON.parse(ev.message).id;
  } catch {
    return;
  }
  const req = new HttpRequest(url);
  req.method = HttpRequestMethod.Post;
  req.body = ev.message;
  req.timeout = 8;
  const headers = [new HttpHeader("Content-Type", "application/json")];
  const token = secrets.get("token");
  if (token) headers.push(new HttpHeader("x-shadowbound-token", token));
  req.headers = headers;
  http.request(req).then((res) => {
    if (res.status !== 200) return;
    try {
      const body = JSON.parse(res.body);
      system.sendScriptEvent("shadowbound:llm_response", JSON.stringify({ id, plan: body.plan }));
    } catch {
      /* invalid response: the add-on times out and falls back to offline mode */
    }
  }).catch(() => undefined);
});
