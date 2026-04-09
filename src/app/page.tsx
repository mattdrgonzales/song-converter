"use client";

import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

// --- Types ---

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
  SoundCloud:
    "M11.56 8.87V17h8.76c1.85 0 3.36-1.5 3.36-3.34 0-1.84-1.51-3.34-3.36-3.34-.34 0-.68.05-1 .15C19.04 8.16 17.14 6.5 14.88 6.5c-1.18 0-2.25.49-3.02 1.28-.1.1-.3.08-.3-.06V8.87zm-1.75.59V17h.88V9.13c-.25-.17-.53-.3-.88-.36v.69zm-1.72.28V17h.87V9.54a4.43 4.43 0 00-.87-.14v.34zm-1.73.85V17h.88v-6.15c-.3.06-.6.14-.88.26v-.01zM4.63 12V17h.87v-5.1c-.3.02-.6.05-.87.1zm-1.74.67V17h.87v-4.12c-.31.2-.6.44-.87.72v.07zM1.15 14.1V17H2v-2.63c-.3.18-.58.42-.85.72z",
};

const PLATFORM_COLORS: Record<string, string> = {
  Spotify: "#1DB954",
  "Apple Music": "#FA243C",
  YouTube: "#FF0000",
  SoundCloud: "#FF5500",
};

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "This week", days: 7 },
  { label: "30 days", days: 30 },
];

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-4 h-4 shrink-0"} fill={PLATFORM_COLORS[platform] ?? "currentColor"}>
      <path d={PLATFORM_ICONS[platform] ?? ""} />
    </svg>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      if (!data.success) { setError(data.error); return; }
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
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full h-10 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 cursor-pointer transition-colors">
              Choose Photo
            </button>
          </div>
        )}

        {step === "crop" && (
          <div className="space-y-3">
            <div className="relative w-full h-64 rounded-lg overflow-hidden bg-black">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            </div>
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            <button type="button" onClick={handleCropDone} className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium cursor-pointer hover:bg-zinc-200 transition-colors">
              Crop
            </button>
          </div>
        )}

        {step === "name" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <img src={croppedImage} alt="Preview" className="w-16 h-16 rounded-full" />
            </div>
            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" maxLength={20} className="w-full h-10 px-3 rounded-lg border border-zinc-700 bg-transparent text-sm outline-none focus:ring-2 focus:ring-zinc-100 transition-shadow" autoFocus />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button type="button" onClick={handleSave} disabled={saving || !profileName.trim()} className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium cursor-pointer hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving..." : "Save Profile"}
            </button>
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [filterSubmitter, setFilterSubmitter] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterDays, setFilterDays] = useState<number | null>(null);

  const avatarMap: Record<string, string> = {};
  for (const p of profiles) avatarMap[p.name] = p.img;
  const activeProfile = profiles.find((p) => p.name === name);
  const hasFilters = filterSubmitter || filterPlatform || filterDays !== null;

  function getSinceDate(days: number | null): string {
    if (days === null) return "";
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  async function fetchRecent(cursor?: string | null, append = false, submitter?: string, platform?: string, days?: number | null) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const sub = submitter ?? filterSubmitter;
    const plat = platform ?? filterPlatform;
    const d = days !== undefined ? days : filterDays;
    if (sub) params.set("submitter", sub);
    if (plat) params.set("platform", plat);
    const since = getSinceDate(d);
    if (since) params.set("since", since);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/recent${qs}`);
    const data = await res.json();
    setRecent((prev) => append ? [...(prev ?? []), ...(data.songs ?? [])] : data.songs ?? []);
    setRecentCursor(data.cursor ?? null);
    setHasMore(data.hasMore ?? false);
  }

  function applyFilter(submitter: string, platform: string, days?: number | null) {
    const d = days !== undefined ? days : filterDays;
    setFilterSubmitter(submitter);
    setFilterPlatform(platform);
    if (days !== undefined) setFilterDays(days);
    setRecent(null);
    fetchRecent(null, false, submitter, platform, d).catch(() => setRecent([]));
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

  async function handleAddSong(e: FormEvent) {
    e.preventDefault();
    if (!addUrl.trim() || addLoading) return;
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl.trim(), submitted_by: name || undefined }),
      });
      const data = await res.json();
      if (!data.success) { setAddError(data.error); return; }
      setAddUrl("");
      fetchRecent().catch(() => {});
    } catch {
      setAddError("Something went wrong. Try again.");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <main className="relative flex flex-col min-h-screen">
      {/* Subtle background icon */}
      <div className="pointer-events-none fixed inset-0 bg-center bg-no-repeat opacity-[0.04] hidden md:block" style={{ backgroundImage: "url(/icon.png)", backgroundSize: "400px" }} />

      {/* Header bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 h-14 flex items-center gap-3 md:gap-4">
          <h1 className="text-sm font-semibold tracking-tight whitespace-nowrap shrink-0">Real Friends Share Music</h1>

          {/* Inline URL input */}
          <form onSubmit={handleAddSong} className="flex-1 min-w-0">
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="Paste a link..."
              autoComplete="off"
              className="w-full h-8 px-3 rounded-lg border border-zinc-700 bg-zinc-900/60 text-sm outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 transition-all placeholder:text-zinc-600"
            />
          </form>

          {/* Profile selector */}
          <div className="relative shrink-0">
            <button type="button" onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-1.5 cursor-pointer rounded-lg px-1.5 py-1.5 hover:bg-zinc-800/60 transition-colors">
              {activeProfile ? (
                <img src={activeProfile.img} alt={activeProfile.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-zinc-500">
                    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                  </svg>
                </div>
              )}
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-zinc-500">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden">
                  <div className="py-1">
                    {profiles.map((p) => (
                      <button key={p.name} type="button" onClick={() => selectProfile(p.name)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${name === p.name ? "bg-zinc-800/80" : "hover:bg-zinc-800/40"}`}>
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
                    <button type="button" onClick={() => { setShowProfileMenu(false); setShowAddProfile(true); }} className="w-full px-3 py-2.5 text-left text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 cursor-pointer transition-colors">
                      + New profile
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Song table */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select
            value={filterSubmitter}
            onChange={(e) => applyFilter(e.target.value, filterPlatform)}
            className="h-8 pl-2 pr-6 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 outline-none cursor-pointer appearance-none focus:border-zinc-600 transition-colors"
          >
            <option value="">All people</option>
            {profiles.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>

          <select
            value={filterPlatform}
            onChange={(e) => applyFilter(filterSubmitter, e.target.value)}
            className="h-8 pl-2 pr-6 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 outline-none cursor-pointer appearance-none focus:border-zinc-600 transition-colors"
          >
            <option value="">All platforms</option>
            <option value="spotify">Spotify</option>
            <option value="apple">Apple Music</option>
            <option value="youtube">YouTube</option>
            <option value="soundcloud">SoundCloud</option>
          </select>

          <div className="flex gap-1">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyFilter(filterSubmitter, filterPlatform, filterDays === preset.days ? null : preset.days)}
                className={`text-[10px] px-2 py-1 rounded-md cursor-pointer transition-all border ${
                  filterDays === preset.days
                    ? "border-zinc-500 text-zinc-200 bg-zinc-800"
                    : "border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button type="button" onClick={() => { setFilterSubmitter(""); setFilterPlatform(""); setFilterDays(null); applyFilter("", "", null); }} className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors ml-1">
              Clear
            </button>
          )}
        </div>

        {recent === null ? (
          <div className="space-y-1">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-zinc-800/20 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-zinc-500">{hasFilters ? "No results for this filter." : "No songs shared yet. Paste a link above to get started."}</p>
          </div>
        ) : (
          <>
            {/* Table header — desktop only */}
            <div className="hidden md:grid grid-cols-[2fr_minmax(120px,1fr)_100px] gap-4 px-4 pb-2 border-b border-zinc-800/40">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Song</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Shared by</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 text-right">Listen</span>
            </div>

            {/* Song rows */}
            <div>
              {recent.map((s, i) => (
                <div
                  key={`${s.song_title}-${i}`}
                  className="group grid grid-cols-[1fr_auto] md:grid-cols-[2fr_minmax(120px,1fr)_100px] gap-4 items-center px-4 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/10 transition-colors"
                >
                  {/* Song + avatar */}
                  <div className="flex items-center gap-3 min-w-0">
                    {s.submitted_by && avatarMap[s.submitted_by] ? (
                      <img src={avatarMap[s.submitted_by]} alt={s.submitted_by} title={s.submitted_by} className="w-8 h-8 rounded-full object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800/60 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.song_title}
                        <span className="font-normal text-zinc-500"> by {s.artist}</span>
                      </p>
                      {/* Mobile: shared by + date inline */}
                      <p className="md:hidden text-[11px] text-zinc-600 truncate">
                        {s.submitted_by || "Someone"}{s.last_searched ? ` · ${formatDate(s.last_searched)}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Shared by — desktop */}
                  <p className="hidden md:block text-xs text-zinc-500 truncate">
                    {s.submitted_by || "—"}
                    {s.last_searched && (
                      <span className="text-zinc-600"> · {formatDate(s.last_searched)}</span>
                    )}
                  </p>

                  {/* Platform links — always show all available */}
                  <div className="flex items-center justify-end gap-3 shrink-0">
                    {s.spotify_link && (
                      <a href={s.spotify_link} target="_blank" rel="noopener noreferrer" title="Spotify" className="opacity-70 hover:opacity-100 transition-opacity">
                        <PlatformIcon platform="Spotify" className="w-[18px] h-[18px]" />
                      </a>
                    )}
                    {s.apple_music_link && (
                      <a href={s.apple_music_link} target="_blank" rel="noopener noreferrer" title="Apple Music" className="opacity-70 hover:opacity-100 transition-opacity">
                        <PlatformIcon platform="Apple Music" className="w-[18px] h-[18px]" />
                      </a>
                    )}
                    {s.youtube_link && (
                      <a href={s.youtube_link} target="_blank" rel="noopener noreferrer" title="YouTube" className="opacity-70 hover:opacity-100 transition-opacity">
                        <PlatformIcon platform="YouTube" className="w-[18px] h-[18px]" />
                      </a>
                    )}
                    {s.soundcloud_link && (
                      <a href={s.soundcloud_link} target="_blank" rel="noopener noreferrer" title="SoundCloud" className="opacity-70 hover:opacity-100 transition-opacity">
                        <PlatformIcon platform="SoundCloud" className="w-[18px] h-[18px]" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
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

      {/* Error toast for add song */}
      {addError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 text-red-200 text-xs px-4 py-2 rounded-lg shadow-lg" onClick={() => setAddError("")}>
          {addError}
        </div>
      )}

      {/* Loading indicator */}
      {addLoading && (
        <div className="fixed top-14 left-0 right-0 z-50 h-0.5 bg-zinc-800 overflow-hidden">
          <div className="h-full bg-white/60 animate-pulse w-1/2" />
        </div>
      )}

      {showAddProfile && <AddProfileModal onClose={() => setShowAddProfile(false)} onCreated={handleProfileCreated} />}
    </main>
  );
}
