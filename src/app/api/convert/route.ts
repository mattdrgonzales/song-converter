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

async function getSpotifyToken(): Promise<string> {
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
  return data.access_token;
}

// --- Platform detection ---

function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (host.includes("spotify.com")) return "spotify";
    if (host.includes("apple.com")) return "apple";
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("soundcloud.com")) return "soundcloud";
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
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SongConverter/1.0)" },
  });
  if (!res.ok) throw new Error("Could not fetch song info from Apple Music.");
  const html = await res.text();

  const titleMatch = html.match(/<meta\s+(?:property="og:title"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:title")/i);
  const descMatch = html.match(/<meta\s+(?:property="og:description"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:description")/i);
  const imgMatch = html.match(/<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/i);

  const rawTitle = titleMatch?.[1] ?? titleMatch?.[2] ?? "Unknown";

  let title = rawTitle
    .replace(/\s*[-–—]\s*(Single|EP|Album)$/i, "")
    .replace(/\s+on\s+Apple\s*Music.*$/i, "");

  let artistFromTitle = "";
  const byMatch = title.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    title = byMatch[1].trim();
    artistFromTitle = byMatch[2].trim();
  }

  const descText = descMatch?.[1] ?? descMatch?.[2] ?? "";
  const artistFromDesc = descText.match(/(?:a\s+)?(?:song|album|single|EP)\s+by\s+(.+?)(?:\s+on\s+Apple\s+Music)?$/i);
  const artistFromDot = descText.split("·")[0]?.trim();

  const artist = artistFromTitle
    || artistFromDesc?.[1]
    || (artistFromDot && !["song", "album", "single", "ep"].includes(artistFromDot.toLowerCase()) ? artistFromDot : "")
    || "";

  return { title, artist, thumbnail: imgMatch?.[1] ?? imgMatch?.[2] ?? "", source: "apple" };
}

async function extractFromSoundCloud(url: string): Promise<SongInfo> {
  const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error("Could not fetch track info from SoundCloud.");
  const data = await res.json();

  // oEmbed title is typically "Track Name by Artist Name"
  const raw = data.title ?? "Unknown";
  const byMatch = raw.match(/^(.+?)\s+by\s+(.+)$/i);
  const title = byMatch ? byMatch[1].trim() : raw;
  const artist = byMatch ? byMatch[2].trim() : (data.author_name ?? "");
  const thumbnail = data.thumbnail_url ?? "";

  return { title, artist, thumbnail, source: "soundcloud" };
}

// --- Find direct links on each platform ---

async function findSpotifyLink(title: string, artist: string): Promise<string> {
  try {
    const token = await getSpotifyToken();
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

  try {
    const query = [title, artist].filter(Boolean).join(" ").trim();
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
    sourcePlatform === "apple" ? "Apple Music" :
    sourcePlatform === "soundcloud" ? "SoundCloud" : "YouTube";
  const now = new Date().toISOString();

  // Check if this song already has a record (match on song_title + artist)
  const filterFormula = `AND({song_title}="${info.title.replace(/"/g, '\\"')}",{artist}="${info.artist.replace(/"/g, '\\"')}")`;
  const searchUrl = `${tableUrl}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
  const searchRes = await fetch(searchUrl, { headers });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const existing = searchData.records?.[0];

    if (existing) {
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
            soundcloud_link: linkMap["SoundCloud"] ?? existing.fields?.soundcloud_link ?? "",
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
        soundcloud_link: linkMap["SoundCloud"] ?? "",
        isrc: info.isrc ?? "",
        count: 1,
        last_searched: now,
        ...(submittedBy ? { submitted_by: submittedBy } : {}),
      },
    }),
  });
}

// --- Auto-add to shared playlists ---

function extractSpotifyUri(url: string): string | null {
  const match = url.match(/\/track\/([a-zA-Z0-9]+)/);
  return match ? `spotify:track:${match[1]}` : null;
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ?? url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

async function getSpotifyUserToken(): Promise<string | null> {
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

async function addToSpotifyPlaylist(spotifyUrl: string): Promise<void> {
  const playlistId = process.env.SPOTIFY_PLAYLIST_ID;
  if (!playlistId || !spotifyUrl) return;

  const uri = extractSpotifyUri(spotifyUrl);
  if (!uri) return;

  const token = await getSpotifyUserToken();
  if (!token) return;

  // Check if track is already in playlist (fetch all tracks, paginated)
  const checkRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(uri))&limit=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (checkRes.ok) {
    const checkData = await checkRes.json();
    const existing = (checkData.items ?? []).some(
      (item: { track: { uri: string } }) => item.track?.uri === uri
    );
    if (existing) return;
  }

  await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [uri] }),
  });
}

async function getYouTubeUserToken(): Promise<string | null> {
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

async function addToYouTubePlaylist(youtubeUrl: string): Promise<void> {
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID;
  if (!playlistId || !youtubeUrl) return;

  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) return;

  const token = await getYouTubeUserToken();
  if (!token) return;

  // Check if video is already in playlist
  const checkRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&videoId=${videoId}&maxResults=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (checkRes.ok) {
    const checkData = await checkRes.json();
    if ((checkData.items ?? []).length > 0) return;
  }

  await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });
}

// --- Build links for all platforms ---

interface AllLinks {
  spotify: string;
  apple: string;
  youtube: string;
  soundcloud: string;
}

async function findAllLinks(info: SongInfo, inputUrl: string): Promise<AllLinks> {
  const [spotify, apple, youtube] = await Promise.all([
    info.source === "spotify"
      ? Promise.resolve(inputUrl)
      : findSpotifyLink(info.title, info.artist),
    info.source === "apple"
      ? Promise.resolve(inputUrl)
      : findAppleMusicLink(info.title, info.artist, info.isrc),
    info.source === "youtube"
      ? Promise.resolve(inputUrl)
      : findYouTubeLink(info.title, info.artist),
  ]);
  return {
    spotify,
    apple,
    youtube,
    soundcloud: info.source === "soundcloud" ? inputUrl : "",
  };
}

function buildDisplayLinks(all: AllLinks): PlatformLink[] {
  const links: PlatformLink[] = [];
  if (all.spotify) links.push({ platform: "Spotify", url: all.spotify });
  if (all.apple) links.push({ platform: "Apple Music", url: all.apple });
  if (all.youtube) links.push({ platform: "YouTube", url: all.youtube });
  if (all.soundcloud) links.push({ platform: "SoundCloud", url: all.soundcloud });
  return links;
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
        error: "Paste a link from Spotify, Apple Music, YouTube, or SoundCloud.",
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
    case "soundcloud":
      info = await extractFromSoundCloud(url);
      break;
    default:
      return Response.json(
        { success: false, error: "Unsupported platform." } satisfies ConvertResult,
        { status: 400 }
      );
  }

  const all = await findAllLinks(info, url);
  const displayLinks = buildDisplayLinks(all);

  // Log ALL platform URLs to Airtable
  const allLinks: PlatformLink[] = [
    { platform: "Spotify", url: all.spotify },
    { platform: "Apple Music", url: all.apple },
    { platform: "YouTube", url: all.youtube },
    { platform: "SoundCloud", url: all.soundcloud },
  ];
  after(async () => {
    await logConversion(url, platform, info, allLinks, submittedBy);
    await Promise.allSettled([
      addToSpotifyPlaylist(all.spotify),
      addToYouTubePlaylist(all.youtube),
    ]);
  });

  return Response.json({
    success: true,
    data: {
      title: info.title,
      artist: info.artist,
      thumbnail: info.thumbnail,
      links: displayLinks,
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
