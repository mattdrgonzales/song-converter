"use client";

export default function ShortcutPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
      <div className="w-full max-w-lg space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Install iOS Shortcut
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add Song Converter to your iPhone Share Sheet.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-medium">How it works</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Share a song from Spotify, Apple Music, or YouTube</li>
              <li>Tap <strong className="text-foreground">Song Converter</strong> in the Share Sheet</li>
              <li>Pick which platform link to copy or share</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium">Setup (2 minutes)</h2>
            <ol className="list-decimal list-inside space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                Open the <strong className="text-foreground">Shortcuts</strong> app on your iPhone
              </li>
              <li>
                Tap <strong className="text-foreground">+</strong> to create a new shortcut
              </li>
              <li>
                Name it <strong className="text-foreground">Song Converter</strong>
              </li>
              <li>
                Add action: <strong className="text-foreground">Receive input</strong> from Share Sheet (URLs only)
              </li>
              <li>
                Add action: <strong className="text-foreground">Get Contents of URL</strong>
                <br />
                <code className="mt-1 inline-block px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs break-all">
                  https://song-mixer.vercel.app/api/convert?url=[Shortcut Input]
                </code>
              </li>
              <li>
                Add action: <strong className="text-foreground">Get Dictionary Value</strong> for key <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs">data</code>
              </li>
              <li>
                Add action: <strong className="text-foreground">Get Dictionary Value</strong> for key <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs">links</code>
              </li>
              <li>
                Add action: <strong className="text-foreground">Repeat with Each</strong> item in Links
              </li>
              <li>
                Inside the loop, add: <strong className="text-foreground">Get Dictionary Value</strong> for key <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs">url</code>
              </li>
              <li>
                After the loop, add: <strong className="text-foreground">Choose from List</strong>
              </li>
              <li>
                Add action: <strong className="text-foreground">Copy to Clipboard</strong>
              </li>
              <li>
                Add action: <strong className="text-foreground">Share</strong> (optional — opens Share Sheet with the link)
              </li>
            </ol>
          </div>

          <div className="p-4 rounded-md border border-zinc-200 dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Once set up, the shortcut appears in your Share Sheet whenever you share a link from Spotify, YouTube, or Apple Music.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
