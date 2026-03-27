import type { NextRequest } from "next/server";

export const runtime = "edge";

interface SongInfo {
  title: string;
  artist: string;
  thumbnail: string;
  source: string;
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

async function extractFromSpotify(url: string): Promise<SongInfo> {
  // oEmbed gives us title + thumbnail (no artist)
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const oembedRes = await fetch(oembedUrl);
  if (!oembedRes.ok) throw new Error("Could not fetch song info from Spotify.");
  const oembed = await oembedRes.json();

  // Fetch OG tags for artist (description format: "Artist · Album · Song · Year")
  let artist = "Unknown";
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SongConverter/1.0)" },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const descMatch = html.match(/og:description"\s+content="([^"]+)"/i);
      if (descMatch) {
        // First segment before " · " is the artist
        artist = descMatch[1].split("·")[0].trim() || "Unknown";
      }
    }
  } catch {
    // Fall back to just the title if page fetch fails
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
    artist: data.author_name ?? "Unknown",
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

  const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
    ?? html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
  const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
    ?? html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
  const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
    ?? html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);

  const rawTitle = titleMatch?.[1] ?? "Unknown";
  // OG title is often "Song Name - Single" or "Song Name - EP", strip suffix
  const title = rawTitle.replace(/\s*[-–—]\s*(Single|EP|Album)$/i, "");

  // OG description often contains "A song by Artist Name" or "Song by Artist"
  const descText = descMatch?.[1] ?? "";
  const artistFromDesc = descText.match(/(?:song|album|single|EP)\s+by\s+(.+?)(?:\s+on\s+Apple\s+Music)?$/i);
  const artist = artistFromDesc?.[1] ?? descText.split("·")[0]?.trim() ?? "Unknown";

  return { title, artist, thumbnail: imgMatch?.[1] ?? "", source: "apple" };
}

async function findAppleMusicLink(query: string): Promise<string> {
  const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`;
  const res = await fetch(searchUrl);
  if (!res.ok) return `https://music.apple.com/us/search?term=${encodeURIComponent(query)}`;
  const data = await res.json();
  if (data.resultCount > 0 && data.results[0].trackViewUrl) {
    // Strip the affiliate "?uo=4" param
    return data.results[0].trackViewUrl.replace(/\?uo=\d+$/, "");
  }
  return `https://music.apple.com/us/search?term=${encodeURIComponent(query)}`;
}

async function findYouTubeLink(query: string): Promise<string> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SongConverter/1.0)" },
    });
    if (!res.ok) return searchUrl;
    const html = await res.text();
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  } catch {
    // Fall back to search URL
  }
  return searchUrl;
}

async function buildLinks(info: SongInfo): Promise<{ platform: string; url: string }[]> {
  const query = `${info.title} ${info.artist}`.trim();

  const promises: Promise<{ platform: string; url: string }>[] = [];

  if (info.source !== "spotify") {
    // Spotify has no free search API — keep as search link
    promises.push(
      Promise.resolve({
        platform: "Spotify",
        url: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
      })
    );
  }

  if (info.source !== "apple") {
    promises.push(
      findAppleMusicLink(query).then((url) => ({ platform: "Apple Music", url }))
    );
  }

  if (info.source !== "youtube") {
    promises.push(
      findYouTubeLink(query).then((url) => ({ platform: "YouTube", url }))
    );
  }

  return Promise.all(promises);
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
