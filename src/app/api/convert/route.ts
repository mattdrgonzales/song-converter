import type { NextRequest } from "next/server";

export const runtime = "edge";

interface SongInfo {
  title: string;
  artist: string;
  thumbnail: string;
  source: string;
}

interface PlatformLink {
  platform: string;
  url: string;
}

interface ConvertResult {
  success: boolean;
  data?: {
    title: string;
    artist: string;
    thumbnail: string;
    links: PlatformLink[];
  };
  error?: string;
}

// --- Spotify Auth (Client Credentials) ---

let spotifyToken: string | null = null;
let spotifyTokenExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyTokenExpiry) return spotifyToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify credentials not configured.");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error("Failed to authenticate with Spotify.");
  const data = await res.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return data.access_token;
}

// --- Platform detection ---

function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (host.includes("spotify.com")) return "spotify";
    if (host.includes("apple.com")) return "apple";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    return null;
  } catch {
    return null;
  }
}

// --- Extract song info from source URL ---

async function extractFromSpotify(url: string): Promise<SongInfo> {
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const oembedRes = await fetch(oembedUrl);
  if (!oembedRes.ok) throw new Error("Could not fetch song info from Spotify.");
  const oembed = await oembedRes.json();

  let artist = "";
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SongConverter/1.0)" },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const descMatch = html.match(/og:description"\s+content="([^"]+)"/i);
      if (descMatch) {
        artist = descMatch[1].split("·")[0].trim();
      }
    }
  } catch {
    // title-only fallback
  }

  return {
    title: oembed.title ?? "Unknown",
    artist,
    thumbnail: oembed.thumbnail_url ?? "",
    source: "spotify",
  };
}

async function extractFromYouTube(url: string): Promise<SongInfo> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error("Could not fetch video info from YouTube.");
  const data = await res.json();
  return {
    title: data.title ?? "Unknown",
    artist: data.author_name ?? "",
    thumbnail: data.thumbnail_url ?? "",
    source: "youtube",
  };
}

async function extractFromAppleMusic(url: string): Promise<SongInfo> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SongConverter/1.0)" },
  });
  if (!res.ok) throw new Error("Could not fetch song info from Apple Music.");
  const html = await res.text();

  const titleMatch = html.match(/<meta\s+(?:property="og:title"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:title")/i);
  const descMatch = html.match(/<meta\s+(?:property="og:description"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:description")/i);
  const imgMatch = html.match(/<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/i);

  const rawTitle = titleMatch?.[1] ?? titleMatch?.[2] ?? "Unknown";
  const title = rawTitle.replace(/\s*[-–—]\s*(Single|EP|Album)$/i, "");

  const descText = descMatch?.[1] ?? descMatch?.[2] ?? "";
  const artistFromDesc = descText.match(/(?:song|album|single|EP)\s+by\s+(.+?)(?:\s+on\s+Apple\s+Music)?$/i);
  const artist = artistFromDesc?.[1] ?? descText.split("·")[0]?.trim() ?? "";

  return { title, artist, thumbnail: imgMatch?.[1] ?? imgMatch?.[2] ?? "", source: "apple" };
}

// --- Find direct links on each platform ---

async function findSpotifyLink(query: string): Promise<string> {
  try {
    const token = await getSpotifyToken();
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1&market=US`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const track = data.tracks?.items?.[0];
      if (track?.external_urls?.spotify) {
        return track.external_urls.spotify;
      }
    }
  } catch {
    // fall through to search URL
  }
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

async function findAppleMusicLink(query: string): Promise<string> {
  try {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.resultCount > 0 && data.results[0].trackViewUrl) {
        return data.results[0].trackViewUrl.replace(/\?uo=\d+$/, "");
      }
    }
  } catch {
    // fall through to search URL
  }
  return `https://music.apple.com/us/search?term=${encodeURIComponent(query)}`;
}

async function findYouTubeLink(query: string): Promise<string> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${apiKey}`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        const videoId = data.items?.[0]?.id?.videoId;
        if (videoId) {
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
    }
  } catch {
    // fall through to search URL
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// --- Build links for the other two platforms ---

async function buildLinks(info: SongInfo): Promise<PlatformLink[]> {
  const query = [info.title, info.artist].filter(Boolean).join(" ").trim();

  const promises: Promise<PlatformLink>[] = [];

  if (info.source !== "spotify") {
    promises.push(findSpotifyLink(query).then((url) => ({ platform: "Spotify", url })));
  }

  if (info.source !== "apple") {
    promises.push(findAppleMusicLink(query).then((url) => ({ platform: "Apple Music", url })));
  }

  if (info.source !== "youtube") {
    promises.push(findYouTubeLink(query).then((url) => ({ platform: "YouTube", url })));
  }

  return Promise.all(promises);
}

// --- Main handler ---

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

    const platform = detectPlatform(url);
    if (!platform) {
      return Response.json(
        {
          success: false,
          error: "Paste a link from Spotify, Apple Music, or YouTube.",
        } satisfies ConvertResult,
        { status: 400 }
      );
    }

    let info: SongInfo;
    switch (platform) {
      case "spotify":
        info = await extractFromSpotify(url);
        break;
      case "youtube":
        info = await extractFromYouTube(url);
        break;
      case "apple":
        info = await extractFromAppleMusic(url);
        break;
      default:
        return Response.json(
          { success: false, error: "Unsupported platform." } satisfies ConvertResult,
          { status: 400 }
        );
    }

    const links = await buildLinks(info);

    return Response.json({
      success: true,
      data: {
        title: info.title,
        artist: info.artist,
        thumbnail: info.thumbnail,
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
