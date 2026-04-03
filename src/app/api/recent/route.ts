export const runtime = "edge";

interface RecentSong {
  song_title: string;
  artist: string;
  spotify_link: string;
  apple_music_link: string;
  youtube_link: string;
}

export async function GET(): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    return Response.json({ songs: [] });
  }

  try {
    const params = new URLSearchParams({
      maxRecords: "3",
      "sort[0][field]": "last_searched",
      "sort[0][direction]": "desc",
      "fields[]": "song_title",
    });
    // Airtable doesn't support multiple fields[] in URLSearchParams easily
    const url = `https://api.airtable.com/v0/${baseId}/Conversions?maxRecords=10&sort%5B0%5D%5Bfield%5D=last_searched&sort%5B0%5D%5Bdirection%5D=desc&fields%5B%5D=song_title&fields%5B%5D=artist&fields%5B%5D=spotify_link&fields%5B%5D=apple_music_link&fields%5B%5D=youtube_link`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return Response.json({ songs: [] });
    }

    const data = await res.json();
    const songs: RecentSong[] = (data.records ?? []).map(
      (r: { fields: Record<string, string> }) => ({
        song_title: r.fields.song_title ?? "",
        artist: r.fields.artist ?? "",
        spotify_link: r.fields.spotify_link ?? "",
        apple_music_link: r.fields.apple_music_link ?? "",
        youtube_link: r.fields.youtube_link ?? "",
      })
    );

    return Response.json(
      { songs },
      { headers: { "Cache-Control": "s-maxage=0, stale-while-revalidate" } }
    );
  } catch {
    return Response.json({ songs: [] });
  }
}
