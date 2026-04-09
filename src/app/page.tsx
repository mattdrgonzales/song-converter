"use client";

import { useState, useEffect, type FormEvent } from "react";

interface LinkData {
  platform: string;
  url: string;
}

interface SongData {
  title: string;
  artist: string;
  thumbnail: string;
  links: LinkData[];
}

interface RecentSong {
  song_title: string;
  artist: string;
  spotify_link: string;
  apple_music_link: string;
  youtube_link: string;
  submitted_by: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  Spotify:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3c-.2.3-.6.4-1 .2-2.7-1.6-6-2-10-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.3-1 8.1-.6 11.1 1.2.3.2.4.7.2 1zm1.5-3.3c-.3.4-.8.5-1.2.3-3.1-1.9-7.7-2.4-11.3-1.3-.5.1-1-.1-1.1-.6-.1-.5.1-1 .6-1.1 4.1-1.3 9.2-.7 12.7 1.5.4.2.5.8.3 1.2zm.1-3.4c-3.7-2.2-9.8-2.4-13.3-1.3-.5.2-1.1-.1-1.3-.6-.2-.5.1-1.1.6-1.3 4.1-1.3 10.8-1 15 1.5.5.3.6.9.4 1.4-.3.4-.9.6-1.4.3z",
  "Apple Music":
    "M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.862.358-1.31.083-.567.12-1.137.128-1.71.004-.253.002-.507.002-.76V6.124zM17.07 18.375c0 .076-.004.153-.01.23a1.104 1.104 0 01-.683.916 2.473 2.473 0 01-.636.218c-.553.128-1.09.09-1.592-.2a1.2 1.2 0 01-.62-.9 1.152 1.152 0 01.617-1.19c.296-.15.614-.237.934-.308.34-.075.682-.143 1.02-.225.16-.04.3-.11.377-.274a.63.63 0 00.06-.27V10.2a.503.503 0 00-.372-.508c-.108-.03-.22-.042-.332-.054l-4.542-.492c-.064-.007-.128-.01-.19-.005-.128.013-.236.07-.296.197a.63.63 0 00-.06.27v8.612c0 .089-.003.178-.01.267a1.1 1.1 0 01-.69.917 2.47 2.47 0 01-.636.218c-.554.128-1.09.09-1.592-.2a1.2 1.2 0 01-.62-.9c-.037-.31.07-.584.277-.818.207-.234.473-.375.768-.46.296-.087.6-.15.9-.224.16-.04.322-.078.472-.138.268-.105.397-.3.406-.586V8.29c0-.213.035-.416.148-.6.146-.236.364-.353.627-.32.12.014.24.038.357.063l5.39 1.143c.26.055.47.19.572.45.05.126.074.262.075.4v8.95z",
  YouTube:
    "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
};

const AVATARS: Record<string, string> = {
  Matty: "/matty.png",
  Dommy: "/dommy.png",
  Kelsey: "/kelsey.png",
  Nicky: "/nicky.png",
  Ninna: "/ninna.png",
  Marissa: "/marissa.png",
  Jeff: "/jeff.png",
};

const PLATFORM_COLORS: Record<string, string> = {
  Spotify: "#1DB954",
  "Apple Music": "#FA243C",
  YouTube: "#FF0000",
};

function PlatformIcon({ platform }: { platform: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5 shrink-0"
      fill={PLATFORM_COLORS[platform] ?? "currentColor"}
    >
      <path d={PLATFORM_ICONS[platform] ?? ""} />
    </svg>
  );
}

function PersonCarousel({
  people,
  selected,
  loading,
  onSelect,
}: {
  people: { name: string; img: string }[];
  selected: string;
  loading: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <div
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide py-1 px-8"
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}
    >
      {people.map((person) => (
        <button
          key={person.name}
          type={selected === person.name ? "submit" : "button"}
          disabled={loading}
          onClick={() => onSelect(person.name)}
          title={person.name}
          className={`w-12 h-12 rounded-full overflow-hidden cursor-pointer transition-all duration-200 disabled:cursor-not-allowed shrink-0 snap-center ${
            selected === person.name
              ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950 scale-110"
              : "opacity-70 hover:opacity-100"
          }`}
        >
          <img
            src={person.img}
            alt={person.name}
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}

const PEOPLE = [
  { name: "Matty", img: "/matty.png" },
  { name: "Dommy", img: "/dommy.png" },
  { name: "Kelsey", img: "/kelsey.png" },
  { name: "Nicky", img: "/nicky.png" },
  { name: "Ninna", img: "/ninna.png" },
  { name: "Marissa", img: "/marissa.png" },
  { name: "Jeff", img: "/jeff.png" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [song, setSong] = useState<SongData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("song-converter-name") ?? "";
    }
    return "";
  });
  const [recent, setRecent] = useState<RecentSong[] | null>(null);
  const [recentCursor, setRecentCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function fetchRecent(cursor?: string | null, append = false) {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const res = await fetch(`/api/recent${params}`);
    const d = await res.json();
    setRecent((prev) => append ? [...(prev ?? []), ...(d.songs ?? [])] : d.songs ?? []);
    setRecentCursor(d.cursor ?? null);
    setHasMore(d.hasMore ?? false);
  }

  useEffect(() => {
    fetchRecent().catch(() => setRecent([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setSong(null);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), submitted_by: name.trim() || undefined }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        return;
      }

      setSong(data.data);

      // Refresh recent list from the beginning after conversion
      fetchRecent().catch(() => {});
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, platform: string) {
    await navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div
        className="pointer-events-none fixed inset-0 bg-center bg-no-repeat opacity-[0.04]"
        style={{ backgroundImage: "url(/icon.png)", backgroundSize: "400px" }}
      />
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Share Your Music Here
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
          Paste a Spotify, Apple Music, or YouTube link.
        </p>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col gap-3 items-center">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/track/..."
              className="w-full h-10 px-3 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-shadow"
              required
            />
            {name && !showPicker ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-col items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white ring-offset-2 ring-offset-zinc-950">
                    <img
                      src={AVATARS[name] ?? ""}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {loading && (
                    <span className="text-[10px] text-zinc-400">...</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                >
                  change profile
                </button>
              </div>
            ) : (
              <>
                {/* Mobile: carousel */}
                <div className="md:hidden w-full">
                  <PersonCarousel
                    people={PEOPLE}
                    selected={name}
                    loading={loading}
                    onSelect={(n) => {
                      setName(n);
                      localStorage.setItem("song-converter-name", n);
                      setShowPicker(false);
                    }}
                  />
                </div>
                {/* Desktop: all faces with names */}
                <div className="hidden md:flex gap-4 justify-center">
                  {PEOPLE.map((person) => (
                    <button
                      key={person.name}
                      type={name === person.name ? "submit" : "button"}
                      disabled={loading}
                      onClick={() => {
                        setName(person.name);
                        localStorage.setItem("song-converter-name", person.name);
                        setShowPicker(false);
                      }}
                      className={`flex flex-col items-center gap-1 cursor-pointer transition-all disabled:cursor-not-allowed ${
                        name === person.name
                          ? "opacity-100 scale-110"
                          : "opacity-50 hover:opacity-80"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-full overflow-hidden ${
                          name === person.name
                            ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-950"
                            : ""
                        }`}
                      >
                        <img
                          src={person.img}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">{person.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </form>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-4">
            {error}
          </p>
        )}

        {song && (
          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-4">
              {song.thumbnail && (
                <img
                  src={song.thumbnail}
                  alt=""
                  className="w-16 h-16 rounded-md object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{song.title}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  {song.artist}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {song.links.map((link) => (
                <div
                  key={link.platform}
                  className="flex items-center gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-800"
                >
                  <PlatformIcon platform={link.platform} />
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline flex-1 min-w-0 truncate"
                  >
                    Open in {link.platform}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(link.url, link.platform)}
                    className="shrink-0 text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {copied === link.platform ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
            Recent
          </h2>
          {recent === null ? (
            <div className="space-y-1.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-7 rounded bg-zinc-100 dark:bg-zinc-800/50 animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-600">No conversions yet.</p>
          ) : (
            <>
            <div className="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {recent.map((s, i) => (
                <div
                  key={`${s.song_title}-${i}`}
                  className="flex items-center gap-2 py-2"
                >
                  {s.submitted_by && AVATARS[s.submitted_by] ? (
                    <img
                      src={AVATARS[s.submitted_by]}
                      alt={s.submitted_by}
                      title={s.submitted_by}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                  )}
                  <p className="flex-1 min-w-0 text-xs font-medium truncate">
                    {s.song_title}
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      {" "}&mdash; {s.artist}
                    </span>
                  </p>
                  <div className="flex items-center gap-3 shrink-0">
                    {(() => {
                      const hasSpotify = !!s.spotify_link;
                      const hasApple = !!s.apple_music_link;
                      const hasYouTube = !!s.youtube_link;
                      const showYouTube = hasYouTube && (!hasSpotify || !hasApple);
                      return (
                        <>
                          {hasSpotify && (
                            <a href={s.spotify_link} target="_blank" rel="noopener noreferrer" title="Spotify">
                              <PlatformIcon platform="Spotify" />
                            </a>
                          )}
                          {hasApple && (
                            <a href={s.apple_music_link} target="_blank" rel="noopener noreferrer" title="Apple Music">
                              <PlatformIcon platform="Apple Music" />
                            </a>
                          )}
                          {showYouTube && (
                            <a href={s.youtube_link} target="_blank" rel="noopener noreferrer" title="YouTube">
                              <PlatformIcon platform="YouTube" />
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  await fetchRecent(recentCursor, true).catch(() => {});
                  setLoadingMore(false);
                }}
                className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer transition-colors disabled:opacity-50"
              >
                {loadingMore ? "..." : "more"}
              </button>
            )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
