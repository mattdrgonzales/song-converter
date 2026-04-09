"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

// --- Types ---

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

interface PersonData {
  name: string;
  img: string;
}

// --- Constants ---

const PLATFORM_ICONS: Record<string, string> = {
  Spotify:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3c-.2.3-.6.4-1 .2-2.7-1.6-6-2-10-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.3-1 8.1-.6 11.1 1.2.3.2.4.7.2 1zm1.5-3.3c-.3.4-.8.5-1.2.3-3.1-1.9-7.7-2.4-11.3-1.3-.5.1-1-.1-1.1-.6-.1-.5.1-1 .6-1.1 4.1-1.3 9.2-.7 12.7 1.5.4.2.5.8.3 1.2zm.1-3.4c-3.7-2.2-9.8-2.4-13.3-1.3-.5.2-1.1-.1-1.3-.6-.2-.5.1-1.1.6-1.3 4.1-1.3 10.8-1 15 1.5.5.3.6.9.4 1.4-.3.4-.9.6-1.4.3z",
  "Apple Music":
    "M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.862.358-1.31.083-.567.12-1.137.128-1.71.004-.253.002-.507.002-.76V6.124zM17.07 18.375c0 .076-.004.153-.01.23a1.104 1.104 0 01-.683.916 2.473 2.473 0 01-.636.218c-.553.128-1.09.09-1.592-.2a1.2 1.2 0 01-.62-.9 1.152 1.152 0 01.617-1.19c.296-.15.614-.237.934-.308.34-.075.682-.143 1.02-.225.16-.04.3-.11.377-.274a.63.63 0 00.06-.27V10.2a.503.503 0 00-.372-.508c-.108-.03-.22-.042-.332-.054l-4.542-.492c-.064-.007-.128-.01-.19-.005-.128.013-.236.07-.296.197a.63.63 0 00-.06.27v8.612c0 .089-.003.178-.01.267a1.1 1.1 0 01-.69.917 2.47 2.47 0 01-.636.218c-.554.128-1.09.09-1.592-.2a1.2 1.2 0 01-.62-.9c-.037-.31.07-.584.277-.818.207-.234.473-.375.768-.46.296-.087.6-.15.9-.224.16-.04.322-.078.472-.138.268-.105.397-.3.406-.586V8.29c0-.213.035-.416.148-.6.146-.236.364-.353.627-.32.12.014.24.038.357.063l5.39 1.143c.26.055.47.19.572.45.05.126.074.262.075.4v8.95z",
  YouTube:
    "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
};

const PLATFORM_COLORS: Record<string, string> = {
  Spotify: "#1DB954",
  "Apple Music": "#FA243C",
  YouTube: "#FF0000",
};

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-5 h-5 shrink-0"} fill={PLATFORM_COLORS[platform] ?? "currentColor"}>
      <path d={PLATFORM_ICONS[platform] ?? ""} />
    </svg>
  );
}

// --- Crop helper ---

const MAX_PROFILE_BYTES = 50 * 1024;

async function getCroppedImg(imageSrc: string, crop: Area): Promise<string> {
  const SIZE = 512;
  const HALF = SIZE / 2;
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve) => { image.onload = () => resolve(); image.src = imageSrc; });
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.beginPath();
  ctx.arc(HALF, HALF, HALF, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, SIZE, SIZE);
  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_PROFILE_BYTES && quality > 0.1) {
    quality -= 0.05;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}

// --- Add Profile Modal ---

function AddProfileModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: PersonData) => void }) {
  const [step, setStep] = useState<"pick" | "crop" | "name">("pick");
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [croppedImage, setCroppedImage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setStep("crop");
    };
    reader.readAsDataURL(file);
  }

  async function handleCropDone() {
    if (!croppedArea || !imageSrc) return;
    const result = await getCroppedImg(imageSrc, croppedArea);
    setCroppedImage(result);
    setStep("name");
  }

  async function handleSave() {
    if (!profileName.trim() || !croppedImage) return;
    setSaving(true);
    setError("");
    try {
      const formattedName = profileName.trim().charAt(0).toUpperCase() + profileName.trim().slice(1).toLowerCase();
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formattedName, image: croppedImage }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      onCreated(data.profile);
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Add Profile</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 cursor-pointer text-lg leading-none">&times;</button>
        </div>

        {step === "pick" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">Upload a photo to use as your avatar.</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-10 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 cursor-pointer transition-colors"
            >
              Choose Photo
            </button>
          </div>
        )}

        {step === "crop" && (
          <div className="space-y-3">
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            <button
              type="button"
              onClick={handleCropDone}
              className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium cursor-pointer hover:bg-zinc-200 transition-colors"
            >
              Crop
            </button>
          </div>
        )}

        {step === "name" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <img src={croppedImage} alt="Preview" className="w-16 h-16 rounded-full" />
            </div>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your name"
              maxLength={20}
              className="w-full h-10 px-3 rounded-lg border border-zinc-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-zinc-100 transition-shadow"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !profileName.trim()}
              className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium cursor-pointer hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Add Song Drawer ---

function AddSongDrawer({ name, onClose, onAdded }: { name: string; onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SongData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), submitted_by: name || undefined }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setResult(data.data);
      setUrl("");
      onAdded();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(text: string, platform: string) {
    await navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 rounded-t-2xl md:rounded-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Add a Song</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300 cursor-pointer text-lg leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a Spotify, Apple Music, or YouTube link"
              autoComplete="off"
              autoFocus
              className="flex-1 h-10 px-3 rounded-lg border border-zinc-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-zinc-100 transition-shadow"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-4 rounded-lg bg-white text-black text-sm font-medium cursor-pointer hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? "..." : "Add"}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {result.thumbnail && <img src={result.thumbnail} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{result.title}</p>
                <p className="text-xs text-zinc-400 truncate">{result.artist}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {result.links.map((link) => (
                <a key={link.platform} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-600 transition-colors flex-1 min-w-0">
                  <PlatformIcon platform={link.platform} />
                  <span className="text-xs font-medium truncate">{link.platform}</span>
                </a>
              ))}
            </div>
            <div className="flex gap-2">
              {result.links.map((link) => (
                <button key={`copy-${link.platform}`} type="button" onClick={() => copyLink(link.url, link.platform)} className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors py-1 flex-1">
                  {copied === link.platform ? "Copied!" : `Copy ${link.platform}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main ---

export default function Home() {
  const [recent, setRecent] = useState<RecentSong[] | null>(null);
  const [recentCursor, setRecentCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("song-converter-name") ?? "";
    }
    return "";
  });
  const [profiles, setProfiles] = useState<PersonData[]>([]);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const avatarMap: Record<string, string> = {};
  for (const p of profiles) avatarMap[p.name] = p.img;
  const activeProfile = profiles.find((p) => p.name === name);

  async function fetchRecent(cursor?: string | null, append = false) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/recent${qs}`);
    const data = await res.json();
    setRecent((prev) => append ? [...(prev ?? []), ...(data.songs ?? [])] : data.songs ?? []);
    setRecentCursor(data.cursor ?? null);
    setHasMore(data.hasMore ?? false);
  }

  useEffect(() => {
    fetchRecent().catch(() => setRecent([]));
    fetch("/api/profiles").then((r) => r.json()).then((d) => setProfiles(d.profiles ?? [])).catch(() => {});
  }, []);

  function selectProfile(profileName: string) {
    setName(profileName);
    localStorage.setItem("song-converter-name", profileName);
    setShowProfileMenu(false);
  }

  function handleProfileCreated(profile: PersonData) {
    setProfiles((prev) => [...prev, profile]);
    selectProfile(profile.name);
    setShowAddProfile(false);
  }

  return (
    <main className="relative flex flex-col min-h-screen">
      {/* Subtle background icon */}
      <div className="pointer-events-none fixed inset-0 bg-center bg-no-repeat opacity-[0.04] hidden md:block" style={{ backgroundImage: "url(/icon.png)", backgroundSize: "400px" }} />

      {/* Header bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold tracking-tight">Share Your Music Here</h1>

          <div className="flex items-center gap-3">
            {/* Add song button */}
            <button
              type="button"
              onClick={() => setShowAddSong(true)}
              className="h-8 px-3 rounded-lg bg-white text-black text-xs font-medium cursor-pointer hover:bg-zinc-200 transition-colors"
            >
              + Add Song
            </button>

            {/* Profile selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-zinc-800/60 transition-colors"
              >
                {activeProfile ? (
                  <img src={activeProfile.img} alt={activeProfile.name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-zinc-500">
                      <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                    </svg>
                  </div>
                )}
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-zinc-500">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Profile dropdown */}
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="py-1">
                      {profiles.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => selectProfile(p.name)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                            name === p.name ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"
                          }`}
                        >
                          <img src={p.img} alt={p.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                          <span className="text-xs font-medium truncate">{p.name}</span>
                          {name === p.name && (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white ml-auto shrink-0">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => { setShowProfileMenu(false); setShowAddProfile(true); }}
                        className="w-full px-3 py-2.5 text-left text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        + New profile
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Song table */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-6 py-6">
        {recent === null ? (
          <div className="space-y-3 pt-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-zinc-800/30 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-zinc-500 mb-4">No songs shared yet.</p>
            <button
              type="button"
              onClick={() => setShowAddSong(true)}
              className="h-9 px-4 rounded-lg bg-white text-black text-xs font-medium cursor-pointer hover:bg-zinc-200 transition-colors"
            >
              Share the first one
            </button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_1fr_auto] gap-4 px-3 pb-2 border-b border-zinc-800/50">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Song</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Artist</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 w-28 text-right">Links</span>
            </div>

            {/* Song rows */}
            <div className="divide-y divide-zinc-800/30">
              {recent.map((s, i) => {
                const hasSpotify = !!s.spotify_link;
                const hasApple = !!s.apple_music_link;
                const hasYouTube = !!s.youtube_link;

                return (
                  <div key={`${s.song_title}-${i}`} className="group flex items-center gap-3 py-3 px-3 rounded-lg hover:bg-zinc-800/20 transition-colors -mx-3">
                    {/* Avatar */}
                    {s.submitted_by && avatarMap[s.submitted_by] ? (
                      <img src={avatarMap[s.submitted_by]} alt={s.submitted_by} title={s.submitted_by} className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800/60 shrink-0" title={s.submitted_by || "Unknown"} />
                    )}

                    {/* Song info — stacked on mobile, grid on desktop */}
                    <div className="flex-1 min-w-0 md:grid md:grid-cols-[1fr_1fr] md:gap-4 md:items-center">
                      <p className="text-sm font-medium truncate">{s.song_title}</p>
                      <p className="text-xs text-zinc-400 truncate">{s.artist}</p>
                    </div>

                    {/* Platform links */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasSpotify && (
                        <a href={s.spotify_link} target="_blank" rel="noopener noreferrer" title="Spotify" className="p-1.5 rounded-md hover:bg-zinc-700/40 transition-colors">
                          <PlatformIcon platform="Spotify" className="w-4.5 h-4.5" />
                        </a>
                      )}
                      {hasApple && (
                        <a href={s.apple_music_link} target="_blank" rel="noopener noreferrer" title="Apple Music" className="p-1.5 rounded-md hover:bg-zinc-700/40 transition-colors">
                          <PlatformIcon platform="Apple Music" className="w-4.5 h-4.5" />
                        </a>
                      )}
                      {hasYouTube && (
                        <a href={s.youtube_link} target="_blank" rel="noopener noreferrer" title="YouTube" className="p-1.5 rounded-md hover:bg-zinc-700/40 transition-colors">
                          <PlatformIcon platform="YouTube" className="w-4.5 h-4.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={async () => { setLoadingMore(true); await fetchRecent(recentCursor, true).catch(() => {}); setLoadingMore(false); }}
                className="mt-4 w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors disabled:opacity-50 text-center rounded-lg hover:bg-zinc-800/20"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddSong && (
        <AddSongDrawer
          name={name}
          onClose={() => setShowAddSong(false)}
          onAdded={() => fetchRecent().catch(() => {})}
        />
      )}
      {showAddProfile && <AddProfileModal onClose={() => setShowAddProfile(false)} onCreated={handleProfileCreated} />}
    </main>
  );
}
