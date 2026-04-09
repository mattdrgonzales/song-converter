import type { NextRequest } from "next/server";

export const runtime = "edge";

interface Profile {
  name: string;
  img: string;
}

export async function GET(): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    return Response.json({ profiles: [] });
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Profiles?fields%5B%5D=name&fields%5B%5D=image_base64&sort%5B0%5D%5Bfield%5D=created_at&sort%5B0%5D%5Bdirection%5D=asc`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return Response.json({ profiles: [] });

    const data = await res.json();
    const profiles: Profile[] = (data.records ?? [])
      .filter((r: { fields: Record<string, string> }) => r.fields.name && r.fields.image_base64)
      .map((r: { fields: Record<string, string> }) => ({
        name: r.fields.name,
        img: r.fields.image_base64,
      }));

    return Response.json({ profiles }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch {
    return Response.json({ profiles: [] });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !token) {
    return Response.json({ success: false, error: "Not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const imageBase64 = typeof body.image === "string" ? body.image : "";

    if (!name || name.length > 20) {
      return Response.json({ success: false, error: "Name must be 1-20 characters." }, { status: 400 });
    }

    if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
      return Response.json({ success: false, error: "Invalid image." }, { status: 400 });
    }

    const MAX_IMAGE_BYTES = 50 * 1024; // 50 KB
    if (imageBase64.length > MAX_IMAGE_BYTES) {
      return Response.json(
        { success: false, error: "Image must be under 50 KB." },
        { status: 400 },
      );
    }

    // Check for duplicate name
    const checkUrl = `https://api.airtable.com/v0/${baseId}/Profiles?filterByFormula=${encodeURIComponent(`{name}="${name.replace(/"/g, '\\"')}"`)}&maxRecords=1`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.records?.length > 0) {
        return Response.json({ success: false, error: "Name already taken." }, { status: 409 });
      }
    }

    // Create profile
    const createRes = await fetch(`https://api.airtable.com/v0/${baseId}/Profiles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          name,
          image_base64: imageBase64,
          created_at: new Date().toISOString(),
        },
      }),
    });

    if (!createRes.ok) {
      return Response.json({ success: false, error: "Failed to create profile." }, { status: 500 });
    }

    return Response.json({ success: true, profile: { name, img: imageBase64 } });
  } catch {
    return Response.json({ success: false, error: "Unexpected error." }, { status: 500 });
  }
}
