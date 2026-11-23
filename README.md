# Unstable Universe — fan video library

An unofficial, fan-made video library for the supplied Unstable Universe playlist:

`PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg`

The site fetches the videos currently in that one playlist from the YouTube Data API, including their title, channel, upload date, duration, views, thumbnail, and description. The **Refresh playlist** button loads every API page in official playlist order, so newly added playlist entries appear after the next refresh.

## What is real and what is local

- Video metadata comes from the supplied YouTube playlist when the `YOUTUBE_API_KEY` Worker secret is configured.
- Creator, personal-library, search, and auto-tag filters run in the visitor's browser.
- Tags such as Civilization, Law, Dimension, War, Mafia, Prison, and Bases & vaults are **automatic keyword tags**, not claimed official arc names.
- The device profile, ratings, favorites, watch status, and playback positions are saved only in that browser's `localStorage`. They do not make a real account, sign visitors in, or sync to another device.
- Videos play in an embedded YouTube player. The app resumes a saved position when YouTube's player API is available.
- Watch later, bookmarks, favorite creator, and visual/sound settings are also browser-local. Export/import moves them between browsers by hand.
- Chapters appear only when the uploader wrote timestamps in the YouTube description.
- Creator transitions and sound effects can be turned off in Settings, and are simplified automatically when the system asks for reduced motion.

## Free Cloudflare Workers deployment

This repository is configured as a Cloudflare Worker with static assets, not a build-tool project.

1. Create a free Cloudflare account and push these files to a GitHub repository.
2. In Cloudflare, choose **Workers & Pages → Create application → Workers → Import a repository**.
3. Select this repository and set the root directory to `/`.
4. Leave **Build command** blank and use `npx wrangler deploy` as the deploy command.
5. After the first deploy, open the Worker’s **Settings → Variables and Secrets** and add a **Secret** named `YOUTUBE_API_KEY` containing a Google Cloud YouTube Data API v3 key.
6. Trigger another deploy. Cloudflare provides a free `*.workers.dev` address; no paid domain is required.

Never commit the YouTube key to GitHub or put it in `app.js`.

## Source layout

- `dist/` — exact static files deployed to visitors.
- `functions/api/catalog.js` — playlist-only YouTube metadata API.
- `functions/api/comments.js` — optional top comments API.
- `worker.js` — routes only `/api/*` to the APIs and all other requests to static assets.
- `app.js`, `index.html`, and `styles.css` — editable source mirrors of the deployed `dist/` files. Copy changes into `dist/` before deploying.

## Local preview

Open `index.html` in a browser for the shell UI. A local static server is needed to test the API calls, and they will only work after a Worker deployment with the secret configured.

## Accessibility

The interface provides keyboard-focusable controls, labeled filter buttons, responsive layouts, reduced-motion support, and no emoji-only primary controls. Minecraft item images are decorative; text labels remain available to assistive technology.
