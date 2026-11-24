// Scene Finder index: memorable moments with exact timestamps.
// Sources, all real: uploader chapters (from the video description) and
// timestamps that viewers wrote in the top YouTube comments.
// Built a few videos at a time by the cron (free plan: 50 subrequests per run)
// and stored in ONE D1 config row.

import { ensureSchema, json } from './account.js';

const YT = 'https://www.googleapis.com/youtube/v3';
const KEY = 'moments';
const PER_VIDEO = 14;
const STALE_MS = 3 * 24 * 3600 * 1000;
const STAMP = /(?:^|[^\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/g;
const toSeconds = stamp => stamp.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);

async function readIndex(db) {
  const row = await db.prepare('SELECT value FROM config WHERE key = ?').bind(KEY).first();
  try { return row ? JSON.parse(row.value) : {videos: {}, cursor: 0}; } catch { return {videos: {}, cursor: 0}; }
}
async function writeIndex(db, index) {
  await db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(KEY, JSON.stringify(index)).run();
}

// Pull "12:34 the mace drop" style moments out of a comment.
export function momentsFromComment(text, duration) {
  const found = [];
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  let match;
  STAMP.lastIndex = 0;
  const stamps = [];
  while ((match = STAMP.exec(clean))) stamps.push({stamp: match[1], index: match.index + match[0].indexOf(match[1])});
  if (!stamps.length || stamps.length > 6) return found;
  const labels = stamps.map((entry, position) => {
    const nextIndex = stamps[position + 1]?.index ?? clean.length;
    return clean.slice(entry.index + entry.stamp.length, nextIndex).replace(/^[\s\-–—:|)~]+/, '').trim();
  });
  let skip = -1;
  stamps.forEach((entry, position) => {
    if (position === skip) return;
    const t = toSeconds(entry.stamp);
    if (!t || (duration && t > duration)) return;
    let label = labels[position];
    const isRange = !label || /^(to|until|thru|through)$/i.test(label);
    if (isRange && labels[position + 1]) { label = labels[position + 1]; skip = position + 1; }
    if (!label || stamps.length === 1) label = clean.replace(entry.stamp, ' ').replace(/\b(at|@)\s+(?=\s|$)/gi, ' ').replace(/\s+(at|@)\s*$/i, '');
    label = label.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (label.length >= 3) found.push({t, label});
  });
  return found;
}

export async function indexMoments(env, videos, budget = 25) {
  if (!env.DB || !env.YOUTUBE_API_KEY || !videos?.length) return {skipped: true};
  const db = env.DB;
  await ensureSchema(db);
  const index = await readIndex(db);
  const ids = new Set(videos.map(video => video.id));
  for (const id of Object.keys(index.videos)) if (!ids.has(id)) delete index.videos[id];
  const now = Date.now();
  const queue = [...videos].sort((a, b) => (index.videos[a.id]?.at || 0) - (index.videos[b.id]?.at || 0)).filter(video => !index.videos[video.id] || now - index.videos[video.id].at > STALE_MS).slice(0, budget);
  let done = 0;
  for (const video of queue) {
    const items = (video.chapters || []).map(chapter => ({t: chapter.t, label: chapter.label, source: 'chapter'}));
    try {
      const url = new URL(`${YT}/commentThreads`);
      url.search = new URLSearchParams({part: 'snippet', videoId: video.id, maxResults: '50', order: 'relevance', textFormat: 'plainText', key: env.YOUTUBE_API_KEY});
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const community = [];
        for (const thread of data.items || []) {
          const snippet = thread.snippet?.topLevelComment?.snippet;
          if (!snippet) continue;
          for (const moment of momentsFromComment(snippet.textDisplay, video.durationSeconds)) community.push({...moment, source: 'comment', likes: snippet.likeCount || 0, author: String(snippet.authorDisplayName || '').slice(0, 40)});
        }
        community.sort((a, b) => b.likes - a.likes);
        const kept = [];
        for (const moment of community) {
          if (kept.some(other => Math.abs(other.t - moment.t) <= 8)) continue;
          kept.push(moment);
          if (kept.length >= PER_VIDEO) break;
        }
        items.push(...kept);
      }
    } catch { /* comments disabled or quota: keep chapters */ }
    index.videos[video.id] = {at: now, items: items.sort((a, b) => a.t - b.t)};
    done += 1;
  }
  index.updatedAt = now;
  if (done) await writeIndex(db, index);
  return {indexed: done, total: Object.keys(index.videos).length};
}

export async function handleMoments(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/video') {
    const id = url.searchParams.get('id') || '';
    if (!/^[\w-]{11}$/.test(id)) return json({error: 'Invalid video id.'}, 400);
    if (!env.YOUTUBE_API_KEY) return json({error: 'YouTube API key is not configured.'}, 503);
    const api = new URL(`${YT}/videos`);
    api.search = new URLSearchParams({part: 'snippet,statistics', id, key: env.YOUTUBE_API_KEY});
    const response = await fetch(api);
    if (!response.ok) return json({error: `YouTube request failed (${response.status})`}, 502);
    const item = (await response.json()).items?.[0];
    if (!item) return json({error: 'Video not found.'}, 404);
    return json({id, description: item.snippet.description || '', tags: (item.snippet.tags || []).slice(0, 20), likes: Number(item.statistics?.likeCount || 0), comments: Number(item.statistics?.commentCount || 0)}, 200, {'Cache-Control': 'public, max-age=3600'});
  }
  if (!env.DB) return json({videos: {}}, 200);
  await ensureSchema(env.DB);
  const index = await readIndex(env.DB);
  return json({videos: index.videos, updatedAt: index.updatedAt || 0}, 200, {'Cache-Control': 'public, max-age=600'});
}
