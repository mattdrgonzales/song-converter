import type { NextRequest } from "next/server";

export const runtime = "edge";

interface RecentSong {
  song_title: string;
  artist: string;
  spotify_link: string;
  apple_music_link: string;
  youtube_link: string;
  soundcloud_link: string;
  submitted_by: string;
  last_searched: string;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

export async function GET(request: NextRequest): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    return Response.json({ songs: [], hasMore: false });
  }

  const cursor = request.nextUrl.searchParams.get("cursor") ?? "";
  const submitter = request.nextUrl.searchParams.get("submitter") ?? "";
  const platform = request.nextUrl.searchParams.get("platform") ?? "";
  const since = request.nextUrl.searchParams.get("since") ?? "";
  const pageSize = 25;

  // Build Airtable filter formula
  const filters: string[] = [];
  if (submitter) {
    filters.push(`{submitted_by}="${submitter.replace(/"/g, '\\"')}"`);
  }
  if (platform === "spotify") {
    filters.push(`{spotify_link}!=""`);
  } else if (platform === "apple") {
    filters.push(`{apple_music_link}!=""`);
  } else if (platform === "youtube") {
    filters.push(`{youtube_link}!=""`);
  } else if (platform === "soundcloud") {
    filters.push(`{soundcloud_link}!=""`);
  }
  if (since) {
    filters.push(`IS_AFTER({last_searched},"${since}")`);
  }

  try {
    let url = `https://api.airtable.com/v0/${baseId}/Conversions?pageSize=${pageSize}&sort%5B0%5D%5Bfield%5D=last_searched&sort%5B0%5D%5Bdirection%5D=desc&fields%5B%5D=song_title&fields%5B%5D=artist&fields%5B%5D=spotify_link&fields%5B%5D=apple_music_link&fields%5B%5D=youtube_link&fields%5B%5D=soundcloud_link&fields%5B%5D=submitted_by&fields%5B%5D=last_searched`;

    if (filters.length > 0) {
      const formula = filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`;
      url += `&filterByFormula=${encodeURIComponent(formula)}`;
    }

    if (cursor) {
      url += `&offset=${encodeURIComponent(cursor)}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return Response.json({ songs: [], hasMore: false });
    }

    const data = await res.json();
    const songs: RecentSong[] = (data.records ?? []).map(
      (r: { fields: Record<string, string> }) => ({
        song_title: decodeEntities(r.fields.song_title ?? ""),
        artist: decodeEntities(r.fields.artist ?? ""),
        spotify_link: r.fields.spotify_link ?? "",
        apple_music_link: r.fields.apple_music_link ?? "",
        youtube_link: r.fields.youtube_link ?? "",
        soundcloud_link: r.fields.soundcloud_link ?? "",
        submitted_by: r.fields.submitted_by ?? "",
        last_searched: r.fields.last_searched ?? "",
      })
    );

    return Response.json(
      {
        songs,
        cursor: data.offset ?? null,
        hasMore: !!data.offset,
      },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } }
    );
  } catch {
    return Response.json({ songs: [], hasMore: false });
  }
}
