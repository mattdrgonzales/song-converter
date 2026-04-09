import type { NextRequest } from "next/server";

export const runtime = "edge";

const REDIRECT_URI = "https://mgsongz.vercel.app/api/auth/spotify";
const SCOPES = "playlist-modify-public playlist-modify-private";

export async function GET(request: NextRequest): Promise<Response> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return new Response("Missing credentials", { status: 500 });

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    const params = new URLSearchParams({ response_type: "code", client_id: clientId, scope: SCOPES, redirect_uri: REDIRECT_URI });
    return Response.redirect(`https://accounts.spotify.com/authorize?${params}`);
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
  });
  if (!tokenRes.ok) return new Response(`Failed: ${await tokenRes.text()}`, { status: 500 });
  const tokens = await tokenRes.json();

  return new Response(
    `<pre style="padding:40px;background:#0a0a0a;color:#ededed;font-size:14px">SPOTIFY_REFRESH_TOKEN="${tokens.refresh_token}"\n\nScope: ${tokens.scope}\nDelete this route after copying.</pre>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
