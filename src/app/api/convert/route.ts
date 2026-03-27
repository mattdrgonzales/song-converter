import type { NextRequest } from "next/server";

export const runtime = "edge";

interface OdesliPlatformData {
  url: string;
  entityUniqueId: string;
}

interface OdesliEntity {
  title: string;
  artistName: string;
  thumbnailUrl: string;
}

interface OdesliResponse {
  entityUniqueId: string;
  linksByPlatform: Record<string, OdesliPlatformData>;
  entitiesByUniqueId: Record<string, OdesliEntity>;
}

interface ConvertResult {
  success: boolean;
  data?: {
    title: string;
    artist: string;
    thumbnail: string;
    links: { platform: string; url: string }[];
  };
  error?: string;
}

const PLATFORMS = ["spotify", "appleMusic", "youtube"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtube: "YouTube",
};

function isValidMusicUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validHosts = [
      "open.spotify.com",
      "music.apple.com",
      "www.youtube.com",
      "youtube.com",
      "youtu.be",
      "music.youtube.com",
    ];
    return validHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return Response.json(
        { success: false, error: "Please provide a URL." } satisfies ConvertResult,
        { status: 400 }
      );
    }

    if (!isValidMusicUrl(url)) {
      return Response.json(
        {
          success: false,
          error: "Paste a link from Spotify, Apple Music, or YouTube.",
        } satisfies ConvertResult,
        { status: 400 }
      );
    }

    const odesliUrl = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=US`;
    const odesliRes = await fetch(odesliUrl);

    if (!odesliRes.ok) {
      const status = odesliRes.status;
      if (status === 404) {
        return Response.json(
          {
            success: false,
            error: "Song not found. Make sure the link points to a specific track.",
          } satisfies ConvertResult,
          { status: 404 }
        );
      }
      if (status === 429) {
        const retryAfter = parseInt(odesliRes.headers.get("retry-after") ?? "10", 10);
        return Response.json(
          {
            success: false,
            error: "Rate limited. Retrying...",
            retryAfter: Math.max(retryAfter, 5),
          },
          { status: 429 }
        );
      }
      return Response.json(
        {
          success: false,
          error: `song.link API returned ${status}. Try again in a moment.`,
        } satisfies ConvertResult,
        { status: 502 }
      );
    }

    const data: OdesliResponse = await odesliRes.json();
    const entity = data.entitiesByUniqueId[data.entityUniqueId];

    const links = PLATFORMS.filter((p) => data.linksByPlatform[p]).map((p) => ({
      platform: PLATFORM_LABELS[p],
      url: data.linksByPlatform[p].url,
    }));

    return Response.json({
      success: true,
      data: {
        title: entity?.title ?? "Unknown",
        artist: entity?.artistName ?? "Unknown",
        thumbnail: entity?.thumbnailUrl ?? "",
        links,
      },
    } satisfies ConvertResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json(
      { success: false, error: message } satisfies ConvertResult,
      { status: 500 }
    );
  }
}
