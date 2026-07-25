# Specimen

A one-page tool for auditioning a YouTube channel name before you commit to it. Checks whether the handle is free, finds the channels already answering to that name, and scores how memorable the name is on its own terms.

No backend, no build step, no tracking. You bring your own YouTube Data API key and it goes straight from your browser to Google.

---

## Deploy to GitHub Pages

1. Create a new repository — `specimen` works.
2. Put `index.html` and `specimen-core.js` in the root (both required).
3. Repository **Settings → Pages**. Under *Source*, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. Wait a minute. It'll be live at `https://<your-username>.github.io/specimen/`.

There is no build step and no dependency install. Edit the files and push — that is the whole deployment loop.

### Tests

```bash
node test/run-tests.js
```

No packages to install. The suite covers normalization, handle variants, quota estimates, memorability/uniqueness scoring, verdict thresholds, and basic HTML wiring checks.

---

## Set up a Google Cloud API key

Specimen talks to Google from your browser. You need a **YouTube Data API v3** key. There is no paid setup for light personal use — the default free quota is 10,000 units per day.

### 1. Create a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with a Google account.
3. Click the project picker at the top of the page → **New Project**.
4. Name it something like `specimen` → **Create**.
5. Make sure that project is selected in the project picker before continuing.

### 2. Enable YouTube Data API v3

1. Go to **APIs & Services → Library**  
   (or open [this link](https://console.cloud.google.com/apis/library/youtube.googleapis.com)).
2. Search for **YouTube Data API v3**.
3. Open it and click **Enable**.
4. Wait until the console shows the API as enabled for your project.

Without this step, every request fails even with a valid-looking key.

### 3. Create an API key

1. Go to **APIs & Services → Credentials**  
   (or [open Credentials](https://console.cloud.google.com/apis/credentials)).
2. Click **+ Create credentials → API key**.
3. Copy the key when the dialog appears. You can paste it into Specimen immediately for a quick test.

Keep the key private. Anyone who has it can spend your daily quota.

### 4. Restrict the key (do this before sharing the site)

Still on **Credentials**, click the key you just created (or the pencil edit icon).

#### Application restrictions (who can use the key)

1. Under **Application restrictions**, choose **HTTP referrers (web sites)**.
2. Under **Website restrictions**, click **Add an item** and add the patterns for where you run Specimen:

| Where you open Specimen | Website restriction to add |
|---|---|
| GitHub Pages | `https://<your-username>.github.io/*` |
| This project’s live site | `https://musicofthings.github.io/*` |
| Local server (any port) | `http://localhost/*` **and** `http://127.0.0.1/*` |

Example for this repo on GitHub Pages:

```text
https://musicofthings.github.io/*
```

**Why `/*` on the origin, not `/specimen/*` only**

Browsers call `googleapis.com` cross-origin. They usually send only the **site origin** as the `Referer` (for example `https://musicofthings.github.io/`), **not** the full path `/specimen/`.

| Pattern | Works? |
|---|---|
| `https://musicofthings.github.io/*` | Yes |
| `https://musicofthings.github.io/specimen/*` alone | No — origin-only referrer does not match |
| `https://musicofthings.github.io` without `/*` | Often fails |

If you see *Requests from referer https://…github.io/ are blocked*, your allowlist is wrong or still propagating. Fix the pattern above, save, wait a few minutes, hard-refresh.

#### API restrictions (what the key can call)

1. Under **API restrictions**, choose **Restrict key**.
2. Select **YouTube Data API v3** only.
3. Click **Save**.

Restrictions can take **1–5 minutes** to apply. If a change seems ignored, wait and hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`).

### 5. Use the key in Specimen

1. Open the deployed page (or a local server — do not rely on opening `index.html` as a `file://` URL if the key is referrer-restricted).
2. Paste the key into the **API key** field at the top.
3. Optionally check **Remember in this browser** (stored only in your browser’s `localStorage`).
4. Type a name → choose **Handles only** or **Full scan** → **Audition**.

The page shows the recommended origin pattern (e.g. `https://musicofthings.github.io/*`) next to the key field so you can copy it into Google Cloud.

### 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| *Requests from referer … are blocked* | Website restriction does not match the origin | Add `https://<user>.github.io/*` (not only `/specimen/*`). Save; wait 1–5 min. |
| *Key refused* / 403 | API not enabled, or API restriction too tight | Enable YouTube Data API v3; restrict the key to that API (or “Don’t restrict” while debugging). |
| *API key not valid* / 400 | Wrong key or wrong project | Create the key in the **same** project where the API is enabled; paste the full key. |
| All handles show **Unknown** | Same as above — API error | Read the red status line; it now surfaces the real Google error. |
| Works with restrictions **None**, fails when restricted | Referrer pattern mismatch | Use the origin + `/*` pattern from the table above. |
| Opened as `file://…/index.html` | No normal HTTP origin/referrer | Serve via GitHub Pages or `npx serve` / any local static server. |

**Debug tip:** temporarily set Application restrictions to **None**, confirm Audition works, then put website restrictions back. That separates “bad key / API off” from “referrer pattern wrong.”

### Security notes

- Prefer a restricted key before you leave the tool on a public URL.
- An unrestricted browser key can be copied from DevTools and used by others against your quota.
- Specimen does not send the key to any server of its own — only to Google’s YouTube API.

---

## Quota, and why there are two modes

The default daily allowance is 10,000 units and it resets at midnight Pacific. The two API calls this tool uses cost wildly different amounts:

| Call | Cost | Used for |
|---|---|---|
| `channels.list` | 1 unit | Handle availability, subscriber counts |
| `search.list` | 100 units | Finding channels that already use the name |

That asymmetry is the whole reason for the mode switch:

- **Handles only — 3–4 units.** One unit per handle variant checked (three for a single-word name, four when multi-word forms add a joined `…hq` variant). Enough to eliminate most candidates.
- **Full scan — 104–105 units.** Same handle checks plus `search.list` (100) and a rival stats `channels.list` (1). Roughly 95 runs a day on the default quota.

The UI shows the live cost for the name you typed. Screen your shortlist in handles-only mode, then spend the full scan on the two or three names that survive.

---

## How the scores work

**Uniqueness** is network-derived. It starts at 100 and comes down for taken handles, for exact title matches, and hardest for an exact match with a large subscriber count — because that's what actually buries you in search results rather than merely annoying you. Search terms dominated by very large channels take a further penalty.

**Memorability** never touches the network. It's computed from the string: character count, word count, syllable estimate, vowel-to-consonant balance, alliteration, digits and punctuation, and spelling patterns people commonly get wrong on a first attempt.

The overall verdict weights uniqueness more heavily after a full scan, and memorability more heavily when only handles were checked — because in handles-only mode there simply isn't enough network evidence to lean on.

The weights are all in one place near the bottom of the script if you disagree with them. You probably will, on at least one. Change them.

---

## Known limits

- `search.list` returns what YouTube's ranking thinks is relevant, not an exhaustive list. A quiet channel with your exact name can be missed.
- Subscriber counts are rounded by the API and can be hidden entirely by the channel owner.
- A free handle today is not a reserved handle. Register it the moment a name clears.
- Memorability scoring is heuristic and English-centric. Treat it as a prompt for thinking, not a verdict.
- Trademark conflicts are entirely out of scope. Search separately before you print anything.

---

## License

MIT.
