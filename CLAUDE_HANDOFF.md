# Claude handoff — Unstable Universe Library

## Goal

Continue improving an unofficial Unstable Universe fan video library without breaking its live playlist, privacy model, or Cloudflare Worker deployment.

Live site: https://unstable-universe.cjprogod3.workers.dev/

Repository: https://github.com/cjprogod3-sudo/unstable-universe

## Current working behavior

- The catalog uses only this supplied official playlist: `PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg`.
- **Refresh playlist** follows all YouTube API pages and currently loads 166 videos in official playlist order.
- Videos play in an embedded `youtube-nocookie` player.
- The browser saves a local profile name, favorites, 1–5 personal ratings, watched state, and player resume position with `localStorage`.
- Filters include creators, personal-library states, search, sorting, and clearly labeled automatic keyword tags.
- Creator identities use real Minecraft item images and themes:
  - Wemmbu: purple + mace
  - Parrot: green + spyglass
  - Spoke: rainbow/pink-cyan + totem
  - FlameFrags: red + netherite sword
  - F0_olish: amber + trial key (restored as its own filter; it was previously lumped into "Other")
  - All creators: cyan + nether star
- The UI is responsive, keyboard reachable, reduced-motion aware, and uses a dark liquid-glass visual system.

## Upgrade round 2 (Claude, Nov 2026)

Everything is still browser-local. No accounts, no community voting, no invented lore.

- **Creator transitions** (Web Animations API, transform/opacity only): mace drop + purple shockwave, spyglass lens zoom, totem pop + rainbow burst, netherite sword slash + red wipe, trial key turn, nether star burst. They are cancellable: rapid switching cancels the previous run, and Esc or a click skips. They never block clicks (`pointer-events: none`).
- **Sound effects** are synthesized with Web Audio (no audio files). No sound plays before the first user gesture. Mute is in the nav and on `M`; volume is in Settings.
- **Visual presets**: Minimal / Balanced / Cinematic (`body[data-fx]`). `prefers-reduced-motion` forces Minimal.
- **Library**: Watch later, Bookmarked, per-chip counts, sorts (oldest, most viewed, longest, shortest), length + upload-year filters, a "Continue watching / Watch later" shelf, random unwatched, per-collection empty states, and a "why this tag" tooltip showing the keyword match.
- **Shareable URLs**: `?creator=Parrot&list=Watch+later&tag=War&q=vault&sort=views&len=long&year=2025` and `?v=VIDEO_ID` deep links.
- **Player**: theater mode, a mini player (the same `<dialog>` re-shown non-modally so the iframe never reloads), a resume note with "Start over", local timestamp bookmarks, chapters (**only** when parsed from the uploader's description: first at 0:00, at least 3), up next in the playlist, next from the same creator, "other perspectives" (other creators' uploads within ±3 days), and top YouTube comments behind a click.
- **Bug fixed**: "Watch next" used to close/reopen the dialog, and the async `close` event then destroyed the new player. The player is now torn down synchronously.
- **Bug fixed**: the "Longform" filter regex matched almost every video. It now means 1 hour or longer.
- **Desktop**: Ctrl/Cmd+K command palette (commands + title search), Minecraft-style hotbar (keys 1–9), `/` search, `C` continue, `R` random, and player keys N/F/L/B/T/I.
- **Profile**: favorite creator (opens in that theme), hours watched, progress per creator, highest personal-rated creator, and JSON import (validated) alongside export.
- **API**: `/api/catalog` now also returns `durationSeconds`, `viewCount`, `chapters`, and `unavailable` (private/deleted entries are skipped client-side with a notice). It validates `pageToken`. `/api/comments` validates the video ID format.

## Upgrade round 3 (Claude, Nov 2026)

- **New-upload banner**: a large "New Unstable video!" banner at the top when a playlist video was uploaded within **2 days of the last successful Refresh playlist** (`catalogMeta.refreshedAt`). It hides once that video is watched or dismissed. Dismissals are stored in `unstable-universe-library-dismissed-new-v1`.
- **New uploads** filter chip (My library): videos uploaded within 7 days of the last refresh.
- **Themed background**: a `.theme-wash` layer of per-creator gradients (Spoke is multi-color rainbow), with ambient blobs using `--accent-two`.
- **Interactive items**: each creator has its own item set (e.g. Wemmbu: mace, wind charge, breeze rod, amethyst…; Spoke: totem + rainbow dyes). These are decoration, not lore. Items float and can be grabbed, thrown (they bounce off the screen edges) and clicked (spin, sparks, sound). A mace thrown hard into the bottom edge makes a shockwave. Grabbing only works on empty background (see `BLOCKERS` in `app.js`), so it never steals clicks from buttons, cards or text.
- **Spark trail** on a single `<canvas>` that follows the pointer, rainbow on Spoke. Off in Minimal / reduced motion. The rAF loop stops when nothing is moving and pauses when the tab is hidden.
- **Scrollbars**: filter chips wrap on desktop (no horizontal scroll); on phones they swipe with a hidden bar and a fade edge. Shelves hide their bar and scroll with the mouse wheel. The page scrollbar is thin, transparent and tinted with the theme color.
- **Hotbar** tucks away when idle. It reappears when the pointer nears the bottom center, a number key is pressed, it gets keyboard focus, the small bottom hint is clicked, or (on touch) the page scrolls up.

## Upgrade round 4 (Claude, Nov 2026)

- **Bug fixed**: the page background was painted on `<body>`, which covered every negative-z layer (theme wash, ambient light, floating items) since the original version. It now lives on `<html>`, and body is transparent. Keep it that way, or the background layers disappear again.
- **Liquid glass system**: shared tokens `--lg-tint`, `--lg-sheen`, `--lg-blur`, `--lg-shadow`. Surfaces (`.lg`, cards, dialogs, banner, sidebar, top bar) get a pointer-following specular highlight (`--mx/--my`, set in JS) and a refracted rim (masked gradient border). Video cards use `content-visibility: auto` to keep 166 blurred cards fast. Honors `prefers-reduced-transparency`.
- **Sidebar** (`#sidebar`) holds search, creators, my library, keyword tags, refine (sort/length/year), and settings (preset segmented control, toggles, volume), plus the profile. Three states in `body[data-sidebar]`: `open` (pinned), `rail` (icons only; expands over the page on hover or keyboard focus; toggle with `[` or the chevron; saved in settings), and `drawer` (≤980px, slides in over a scrim, closes after picking a creator or list).
- The old filter panel and settings dialog are gone. `#settingsDialog` now only lists keyboard shortcuts (`?`).
- **Per-video player map: not built.** Nothing in the playlist or YouTube data says where players are. It needs a source (world map + coordinates per video/timestamp) from the owner.

## Upgrade round 5: accounts (Claude, Nov 2026)

- **Server**: `functions/api/account.js`, routed from `worker.js` for `/api/account*`. D1 binding `DB` (database `unstable-universe-accounts`), declared in `wrangler.toml` **without** an ID so Wrangler ≥4.45 auto-creates it on deploy. Tables are created automatically on first request (`CREATE TABLE IF NOT EXISTS`). With no `DB` binding, every endpoint returns 503 and the UI says accounts aren't switched on.
- **Endpoints**: `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `PUT /profile` (optimistic concurrency via `baseUpdatedAt`, 409 + server copy on conflict), `DELETE /api/account` (password required).
- **Security**: PBKDF2-SHA256 (100k iterations, per-user salt), constant-time compare, session token = 32 random bytes in an `HttpOnly; SameSite=Lax; Secure` cookie with only its SHA-256 stored. Same-origin `Origin` header required on every non-GET. Login is rate-limited per username+IP and sign-up per IP (10 per 15 min). Profiles are capped at 300 KB. There's no email, so **passwords cannot be reset**.
- **Sync model** (`app.js`, "Accounts + cross-device sync"): the local profile stays the working copy. `saveProfile()` marks it dirty and pushes after 2.5 s. Pulls happen on load, on tab focus (≥15 s apart), and on reconnect. If only the server changed, its copy is adopted, so deletions such as un-favoriting propagate. If both sides changed (or on first sign-in), the copies are merged: newest progress per video, union of favorites/watch later/bookmarks, local ratings win. Sync state lives in `unstable-universe-library-sync-v1`. Visual settings stay per-device on purpose.
- Tested end to end with two browser contexts against a SQLite stand-in for D1.

### Storage keys (do not rename)

| Key | Contents |
| --- | --- |
| `unstable-universe-library-profile-v1` | profile: name, progress, ratings, favorites, **watchLater**, **bookmarks**, **favoriteCreator**, lastVideoId. Old profiles load unchanged. |
| `unstable-universe-library-catalog-v1` | cached catalog |
| `unstable-universe-library-catalog-meta-v1` | last refresh time, unavailable count |
| `unstable-universe-library-settings-v1` | preset, transitions, sound, volume, theater, sidebar (`open`/`rail`) |
| `unstable-universe-library-dismissed-new-v1` | video IDs whose new-upload banner was dismissed |
| `unstable-universe-library-sync-v1` | signed-in username, server `updatedAt` at last sync, dirty flag |

### Deliberately not built yet (owner decision, Nov 2026)

- Accounts, cloud sync, community voting, leaderboards, Episode of the Week: these need a real backend (e.g. Cloudflare D1 + OAuth) plus moderation. The owner chose browser-only for now.
- Interactive map, 3D exploration, character profiles, Unstable Archive, collectible inventory: these need sourced lore, coordinates, and models. Don't invent them. Build only when verified content exists, and label fan reconstructions.
- A rearrangeable widget dashboard: skipped in favour of a few polished interactions, per the design direction below.

## Architecture

| Path | Purpose |
| --- | --- |
| `dist/` | The exact static site served by Cloudflare. Update this when changing the UI. |
| `index.html`, `styles.css`, `app.js` | Editable mirrors of `dist/`; keep them synchronized with `dist/`. |
| `functions/api/catalog.js` | Server-side YouTube playlist metadata endpoint. It allows only the supplied playlist ID. |
| `functions/api/comments.js` | Optional top-comments endpoint. |
| `worker.js` | Routes `/api/catalog` and `/api/comments`; serves the static assets otherwise. |
| `wrangler.toml` | Cloudflare Worker configuration. |

## Non-negotiable guardrails

1. Do not put `YOUTUBE_API_KEY` in frontend files, commits, screenshots, logs, or documentation.
2. Keep the key as a Cloudflare Worker secret named `YOUTUBE_API_KEY`.
3. Preserve playlist-only behavior unless the owner explicitly chooses another source. Do not silently broaden the catalog to guessed creator playlists.
4. Do not present auto-tags as official arc names. Keep labels such as “Auto tags” or “Keyword tags.”
5. Do not claim there is a real sign-in system. The current “This device” profile is browser-local and intentionally does not sync between devices.
6. Keep `dist/` current; Cloudflare serves it, not the root HTML/CSS/JS files.
7. Preserve the API pagination loop. A playlist can contain more than 50 videos.

## Strong next ideas

### Library and discovery

- Add a compact “season / era” timeline based on verified upload dates, not invented canon.
- Add drag-to-reorder for the Watch later list.

### Player experience


### Personal library

- Support multiple named browser-local profiles with a profile switcher.
- Add a “rewatch” list (watch later and favorites now exist).
- Add private notes per video, clearly local-only.
- Add rating summaries such as “your highest-rated creator” without treating ratings as community scores.

### Visual polish

- Give every auto-tag a verified Minecraft item identity and a subtle themed glass highlight.
- Add low-motion parallax to the active item artifacts, respecting `prefers-reduced-motion`.
- Add better skeleton states while each 50-video API page is loading.
- Add thumbnail color extraction only if it remains fast and does not block rendering.
- Add a mobile bottom sheet for filters and profile controls.

### Data quality and resilience

- Cache a successful catalog response in Cloudflare KV or Cache API with a short TTL if YouTube quota becomes a concern.
- Add small automated checks for catalog pagination, creator matching, and malformed `localStorage` recovery.
- Add a Content Security Policy once all third-party asset and YouTube domains are finalized.

### Optional future platform work

- Accounts exist now. Possible next steps: passkeys, an optional recovery email, admin tools.
- Add moderation-safe community ratings or comments only with a backend, clear rules, and abuse controls.
- Add analytics only with a visible privacy notice and the owner’s approval.

## Design direction

Keep the site premium rather than cluttered:

- Near-black blue background, translucent liquid-glass cards, soft colored light, and clear typography.
- Minecraft item art should reinforce filters, not become decorative noise.
- The videos and their verified metadata should remain the main content.
- Prefer a few polished interactions over adding many dashboard widgets.

## Verification checklist after any change

1. `node --check app.js` and `node --check dist/app.js`.
2. Check `functions/api/catalog.js`, `functions/api/comments.js`, and `worker.js` as ES modules.
3. Confirm `dist/index.html` references `dist/styles.css` and `dist/app.js` correctly.
4. Deploy and call `/api/catalog?playlistId=PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg`.
5. Confirm page two starts at playlist position 51 or later.
6. Open the live site, wait for all pages, and confirm the playlist total, a creator filter, embedded playback, and a locally saved rating.
7. Switch through every creator and confirm each transition ends with no leftover nodes in `#transitionLayer`. Then try Minimal preset and OS reduced motion (instant theme change).
8. In the player: Watch next, Mini player → browse → Expand (video must not restart), a bookmark, theater mode.
