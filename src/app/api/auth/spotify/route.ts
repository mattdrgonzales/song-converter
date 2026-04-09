import type { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * One-time OAuth flow to get a Spotify refresh token.
 *
 * Step 1: Visit /api/auth/spotify — redirects to Spotify authorization
 * Step 2: Spotify redirects back with ?code=... — exchanges for tokens
 * Step 3: Copy the refresh_token into .env.local as SPOTIFY_REFRESH_TOKEN
 *
 * DELETE THIS ROUTE after setup is complete.
 */

const REDIRECT_URI = "https://mgsongz.vercel.app/api/auth/spotify";
const SCOPES = "playlist-modify-public playlist-modify-private";

export async function GET(request: NextRequest): Promise<Response> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET", { status: 500 });
  }

  const code = request.nextUrl.searchParams.get("code");

  // Step 1: No code — redirect to Spotify authorization
  if (!code) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
    });
    return Response.redirect(`https://accounts.spotify.com/authorize?${params}`);
  }

  // Step 2: Exchange code for tokens
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response(`Token exchange failed: ${err}`, { status: 500 });
  }

  const tokens = await tokenRes.json();

  return new Response(
    `<html><body style="font-family:monospace;padding:40px;background:#0a0a0a;color:#ededed">
      <h2>Spotify OAuth Complete</h2>
      <p><strong>Add this to your .env.local:</strong></p>
      <pre style="background:#1a1a1a;padding:16px;border-radius:8px;overflow-x:auto">SPOTIFY_REFRESH_TOKEN="${tokens.refresh_token}"</pre>
      <p style="color:#666;margin-top:24px">Access token (temporary): ${tokens.access_token?.slice(0, 20)}...</p>
      <p style="color:#666">Scopes: ${tokens.scope}</p>
      <p style="color:#f87171;margin-top:24px">Delete the /api/auth/spotify route after copying the token.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
