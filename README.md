# Unstable Universe — fan dashboard

This is a **fan-made interface**. All episode titles, creator associations, tags, dates, descriptions, stats, and widgets are intentional sample data. It does not pull live information, represent creators, or sync watch status anywhere. Watch history and spoiler preference use only the visitor's browser `localStorage`.

## Free Cloudflare Pages deployment

1. Create a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and a GitHub repository containing this folder's files.
2. In Cloudflare, open **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the repository. If this folder is inside a larger repository, set **Root directory** to `outputs/unstable-universe` (or move this folder to the repository root). For this buildless static site, leave **Build command** blank and set **Build output directory** to `dist`.
4. Click **Save and Deploy**. Cloudflare will provide a free `*.pages.dev` address—no purchased domain is required.

### Enable the official live catalog

The Refresh button is intentionally server-backed so the YouTube key never reaches visitors. It uses the linked playlist ID `PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg`, preserves its order, pulls video metadata, and requests top comments only when a visitor opens a video’s Comments panel.

1. In Google Cloud, enable **YouTube Data API v3** and create an API key restricted to that API.
2. In Cloudflare Pages, open the project’s **Settings → Environment variables**. Add a secret named `YOUTUBE_API_KEY` for Production (and Preview if desired).
3. Redeploy. Cloudflare Pages automatically serves `functions/api/catalog.js` and `functions/api/comments.js` as `/api/catalog` and `/api/comments`.

The arc filters are deliberately labeled **auto-tagged**: they sort official results only when a video title contains terms such as “civilization,” “law,” “dimension,” or “war.” They are not claims that the creators officially named those arcs. Update the classifier in `app.js` once verified playlist/arc names are available.

### Git-free alternative

Install Node.js, then run `npx wrangler pages deploy dist --project-name unstable-universe-fan --functions functions` from this folder. Follow the browser sign-in prompt. This also produces a free `pages.dev` address.

## Local preview

Open `index.html` directly in a browser, or serve the folder with any static-file server. No build step or dependency installation is required.

## Accessibility and behavior

- Keyboard-accessible buttons, filters, modal controls, labels, and responsive navigation.
- Spoiler text begins blurred and requires an explicit reveal choice.
- “Mark watched” stores an episode ID only in the current browser.
