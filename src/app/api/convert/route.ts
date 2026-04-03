import type { NextRequest } from "next/server";
import { after } from "next/server";

export const runtime = "edge";

interface SongInfo {
  title: string;
  artist: string;
  thumbnail: string;
  source: string;
  isrc?: string;
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

function extractSpotifyTrackId(url: string): string | null {
  const match = url.match(/\/track\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}

// --- Extract song info from source URL ---

async function extractFromSpotify(url: string): Promise<SongInfo> {
  const trackId = extractSpotifyTrackId(url);

  // Try Spotify API first for rich metadata + ISRC
  if (trackId) {
    try {
      const token = await getSpotifyToken();
      const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=US`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const track = await res.json();
        return {
          title: track.name ?? "Unknown",
          artist: (track.artists ?? []).map((a: { name: string }) => a.name).join(", "),
          thumbnail: track.album?.images?.[0]?.url ?? "",
          source: "spotify",
          isrc: track.external_ids?.isrc ?? undefined,
        };
      }
    } catch {
      // fall through to oEmbed
    }
  }

  // Fallback: oEmbed + OG scrape
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
  // Try to extract track ID from URL for ISRC lookup later
  const trackIdMatch = url.match(/[?&]i=(\d+)/) ?? url.match(/\/song\/[^/]+\/(\d+)/);

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SongConverter/1.0)" },
  });
  if (!res.ok) throw new Error("Could not fetch song info from Apple Music.");
  const html = await res.text();

  const titleMatch = html.match(/<meta\s+(?:property="og:title"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:title")/i);
  const descMatch = html.match(/<meta\s+(?:property="og:description"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:description")/i);
  const imgMatch = html.match(/<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/i);

  const rawTitle = titleMatch?.[1] ?? titleMatch?.[2] ?? "Unknown";

  // OG title formats: "Song Name - Single", "Song Name by Artist on Apple Music"
  let title = rawTitle
    .replace(/\s*[-–—]\s*(Single|EP|Album)$/i, "")
    .replace(/\s+on\s+Apple\s*Music.*$/i, "");

  // Extract artist from "Song by Artist" pattern in title
  let artistFromTitle = "";
  const byMatch = title.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    title = byMatch[1].trim();
    artistFromTitle = byMatch[2].trim();
  }

  // Also try the description: "A song by Artist on Apple Music" or "Artist · Album · ..."
  const descText = descMatch?.[1] ?? descMatch?.[2] ?? "";
  const artistFromDesc = descText.match(/(?:a\s+)?(?:song|album|single|EP)\s+by\s+(.+?)(?:\s+on\s+Apple\s+Music)?$/i);
  const artistFromDot = descText.split("·")[0]?.trim();

  const artist = artistFromTitle
    || artistFromDesc?.[1]
    || (artistFromDot && !["song", "album", "single", "ep"].includes(artistFromDot.toLowerCase()) ? artistFromDot : "")
    || "";

  return { title, artist, thumbnail: imgMatch?.[1] ?? imgMatch?.[2] ?? "", source: "apple" };
}

// --- Find direct links on each platform ---

async function findSpotifyLink(title: string, artist: string): Promise<string> {
  const query = [title, artist].filter(Boolean).join(" ").trim();
  try {
    const token = await getSpotifyToken();
    // Use field filters for better precision
    const primaryArtist = artist.split(",")[0].trim();
    const q = primaryArtist
      ? `track:${title} artist:${primaryArtist}`
      : title;
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5&market=US`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const items = data.tracks?.items ?? [];
      // Prefer exact title match
      const titleLower = title.toLowerCase();
      const exact = items.find(
        (t: { name: string }) => t.name.toLowerCase() === titleLower
      );
      const best = exact ?? items[0];
      if (best?.external_urls?.spotify) {
        return best.external_urls.spotify;
      }
    }
  } catch {
    // fall through
  }
  return "";
}

async function findAppleMusicLink(title: string, artist: string, isrc?: string): Promise<string> {
  const query = [title, artist].filter(Boolean).join(" ").trim();

  // Strategy 1: Search by ISRC if available (most precise, finds pre-releases)
  if (isrc) {
    try {
      const isrcUrl = `https://itunes.apple.com/lookup?isrc=${isrc}&entity=song&country=US`;
      const res = await fetch(isrcUrl);
      if (res.ok) {
        const data = await res.json();
        const song = data.results?.find((r: { kind?: string }) => r.kind === "song");
        if (song?.trackViewUrl) {
          return song.trackViewUrl.replace(/\?uo=\d+$/, "");
        }
      }
    } catch {
      // fall through to text search
    }
  }

  // Strategy 2: Text search with title match filtering
  try {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`;
    const res = await fetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      const results = data.results ?? [];
      const titleLower = title.toLowerCase();
      const exact = results.find(
        (r: { trackName?: string }) => r.trackName?.toLowerCase() === titleLower
      );
      const best = exact ?? results[0];
      if (best?.trackViewUrl) {
        return best.trackViewUrl.replace(/\?uo=\d+$/, "");
      }
    }
  } catch {
    // fall through
  }

  return "";
}

async function findYouTubeLink(title: string, artist: string): Promise<string> {
  const query = [title, artist].filter(Boolean).join(" ").trim();
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
    // fall through
  }
  return "";
}

// --- Log conversion to Airtable ---

async function logConversion(
  inputUrl: string,
  sourcePlatform: string,
  info: SongInfo,
  links: PlatformLink[],
  submittedBy?: string
): Promise<void> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  if (!baseId || !token) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const tableUrl = `https://api.airtable.com/v0/${baseId}/Conversions`;

  const linkMap = Object.fromEntries(links.map((l) => [l.platform, l.url]));
  const platformLabel =
    sourcePlatform === "spotify" ? "Spotify" :
    sourcePlatform === "apple" ? "Apple Music" : "YouTube";
  const now = new Date().toISOString();

  // Check if this song already has a record (match on song_title + artist)
  const filterFormula = `AND({song_title}="${info.title.replace(/"/g, '\\"')}",{artist}="${info.artist.replace(/"/g, '\\"')}")`;
  const searchUrl = `${tableUrl}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  const searchRes = await fetch(searchUrl, { headers });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const existing = searchData.records?.[0];

    if (existing) {
      // Update: increment count, update last_searched and links
      const currentCount = (existing.fields?.count as number) ?? 1;
      await fetch(`${tableUrl}/${existing.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          fields: {
            count: currentCount + 1,
            last_searched: now,
            input_url: inputUrl,
            spotify_link: linkMap["Spotify"] ?? existing.fields?.spotify_link ?? "",
            apple_music_link: linkMap["Apple Music"] ?? existing.fields?.apple_music_link ?? "",
            youtube_link: linkMap["YouTube"] ?? existing.fields?.youtube_link ?? "",
            isrc: info.isrc ?? existing.fields?.isrc ?? "",
            ...(submittedBy ? { submitted_by: submittedBy } : {}),
          },
        }),
      });
      return;
    }
  }

  // Create new record
  await fetch(tableUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fields: {
        input_url: inputUrl,
        source_platform: platformLabel,
        song_title: info.title,
        artist: info.artist,
        spotify_link: linkMap["Spotify"] ?? "",
        apple_music_link: linkMap["Apple Music"] ?? "",
        youtube_link: linkMap["YouTube"] ?? "",
        isrc: info.isrc ?? "",
        count: 1,
        last_searched: now,
        ...(submittedBy ? { submitted_by: submittedBy } : {}),
      },
    }),
  });
}

// --- Build links for the other two platforms ---

async function buildLinks(info: SongInfo, inputUrl: string): Promise<PlatformLink[]> {
  const sourcePlatformLabel =
    info.source === "spotify" ? "Spotify" :
    info.source === "apple" ? "Apple Music" : "YouTube";

  const promises: Promise<PlatformLink>[] = [];

  if (info.source !== "spotify") {
    promises.push(
      findSpotifyLink(info.title, info.artist).then((url) => ({ platform: "Spotify", url }))
    );
  }

  if (info.source !== "apple") {
    promises.push(
      findAppleMusicLink(info.title, info.artist, info.isrc).then((url) => ({ platform: "Apple Music", url }))
    );
  }

  if (info.source !== "youtube") {
    promises.push(
      findYouTubeLink(info.title, info.artist).then((url) => ({ platform: "YouTube", url }))
    );
  }

  const found = await Promise.all(promises);
  const filtered = found.filter((link) => link.url !== "");

  // Always include the source platform link
  return [{ platform: sourcePlatformLabel, url: inputUrl }, ...filtered];
}

// --- Main handler ---

async function handleConvert(url: string, submittedBy?: string): Promise<Response> {
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

  const links = await buildLinks(info, url);

  after(() => logConversion(url, platform, info, links, submittedBy));

  return Response.json({
    success: true,
    data: {
      title: info.title,
      artist: info.artist,
      thumbnail: info.thumbnail,
      links,
    },
  } satisfies ConvertResult);
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const submittedBy = typeof body.submitted_by === "string" ? body.submitted_by.trim() : undefined;
    return handleConvert(url, submittedBy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json(
      { success: false, error: message } satisfies ConvertResult,
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";
    const submittedBy = request.nextUrl.searchParams.get("by")?.trim() || undefined;
    return handleConvert(url, submittedBy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json(
      { success: false, error: message } satisfies ConvertResult,
      { status: 500 }
    );
  }
}
