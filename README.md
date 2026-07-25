# Specimen

A one-page tool for auditioning a YouTube channel name before you commit to it. Checks whether the handle is free, finds the channels already answering to that name, and scores how memorable the name is on its own terms.

No backend, no build step, no tracking. You bring your own YouTube Data API key and it goes straight from your browser to Google.

---

## Deploy to GitHub Pages

1. Create a new repository — `specimen` works.
2. Add `index.html` to the root. That's the entire application.
3. Repository **Settings → Pages**. Under *Source*, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
4. Wait a minute. It'll be live at `https://<your-username>.github.io/specimen/`.

There is no build step and no dependency install. Editing `index.html` and pushing is the whole deployment loop.

---

## Getting an API key

1. Open the [Google Cloud console](https://console.cloud.google.com/) and create a project.
2. Enable **YouTube Data API v3** under APIs & Services → Library.
3. Credentials → Create credentials → API key.
4. **Restrict it.** Click the key, set *Application restrictions* to **Websites**, and add `https://<your-username>.github.io/*`. Then set *API restrictions* to YouTube Data API v3 only.

Step 4 matters. An unrestricted key in a browser can be lifted from your network tab and spent by someone else.

---

## Quota, and why there are two modes

The default daily allowance is 10,000 units and it resets at midnight Pacific. The two API calls this tool uses cost wildly different amounts:

| Call | Cost | Used for |
|---|---|---|
| `channels.list` | 1 unit | Handle availability, subscriber counts |
| `search.list` | 100 units | Finding channels that already use the name |

That asymmetry is the whole reason for the mode switch:

- **Handles only — 3 units.** Checks four handle variants. Enough to eliminate most candidates. You can run this roughly 3,000 times a day.
- **Full scan — 104 units.** Adds the rival search and the collision strip. About 95 runs a day.

Screen your shortlist in handles-only mode, then spend the full scan on the two or three names that survive.

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
