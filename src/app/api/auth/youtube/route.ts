import type { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * One-time OAuth flow to get a YouTube refresh token.
 *
 * Step 1: Visit /api/auth/youtube — redirects to Google authorization
 * Step 2: Google redirects back with ?code=... — exchanges for tokens
 * Step 3: Copy the refresh_token into .env.local as YOUTUBE_REFRESH_TOKEN
 *
 * DELETE THIS ROUTE after setup is complete.
 */

const REDIRECT_URI = "http://localhost:3000/api/auth/youtube";
const SCOPES = "https://www.googleapis.com/auth/youtube";

export async function GET(request: NextRequest): Promise<Response> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Set these in .env.local.", { status: 500 });
  }

  const code = request.nextUrl.searchParams.get("code");

  // Step 1: No code — redirect to Google authorization
  if (!code) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      access_type: "offline",
      prompt: "consent",
    });
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // Step 2: Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return new Response(`Token exchange failed: ${err}`, { status: 500 });
  }

  const tokens = await tokenRes.json();

  return new Response(
    `<html><body style="font-family:monospace;padding:40px;background:#0a0a0a;color:#ededed">
      <h2>YouTube OAuth Complete</h2>
      <p><strong>Add this to your .env.local:</strong></p>
      <pre style="background:#1a1a1a;padding:16px;border-radius:8px;overflow-x:auto">YOUTUBE_REFRESH_TOKEN="${tokens.refresh_token}"</pre>
      <p style="color:#666;margin-top:24px">Access token (temporary): ${tokens.access_token?.slice(0, 20)}...</p>
      <p style="color:#f87171;margin-top:24px">Delete the /api/auth/youtube route after copying the token.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
