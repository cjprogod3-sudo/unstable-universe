const YT = 'https://www.googleapis.com/youtube/v3';
const SEED_PLAYLIST = 'PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg';
const OFFICIAL_HANDLES = ['Spokeishere', 'wemmbumc', 'ParrotX2', 'FlameFragsMC'];
const duration = value => { const m=value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/),h=Number(m?.[1]||0),min=Number(m?.[2]||0),sec=Number(m?.[3]||0);return h?`${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${min}:${String(sec).padStart(2,'0')}`; };
const ago = iso => {const d=Math.max(1,Math.floor((Date.now()-new Date(iso))/86400000));return d<30?`${d} days ago`:d<365?`${Math.floor(d/30)} months ago`:`${Math.floor(d/365)} years ago`;};
const compact = n => new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(Number(n||0));
const creator = title => /wemmbu/i.test(title)?'Wemmbu':/parrot/i.test(title)?'Parrot':/spoke/i.test(title)?'Spoke':/flamefrags/i.test(title)?'FlameFrags':title;
const relevant = title => /unstable|civilization|dimension\s*war|law\s*arc/i.test(title||'');
async function api(path, params, key) {const url=new URL(`${YT}/${path}`);url.search=new URLSearchParams({...params,key});const r=await fetch(url);if(!r.ok)throw new Error(`YouTube ${path} request failed (${r.status})`);return r.json();}
async function pages(path, params, key) {let token='',all=[];do {const data=await api(path,{...params,maxResults:'50',pageToken:token},key);all.push(...data.items);token=data.nextPageToken||'';} while(token);return all;}
async function discoverPlaylists(key) {
  const sources=new Map([[SEED_PLAYLIST,{id:SEED_PLAYLIST,title:'Supplied official playlist'}]]);
  for (const handle of OFFICIAL_HANDLES) {
    const channel=(await api('channels',{part:'id,snippet',forHandle:handle},key)).items?.[0]; if(!channel) continue;
    const lists=await pages('playlists',{part:'snippet',channelId:channel.id},key);
    lists.filter(x=>relevant(x.snippet?.title)).forEach(x=>sources.set(x.id,{id:x.id,title:x.snippet.title}));
  }
  return [...sources.values()];
}
export async function handleCatalog(request, env) {
  if(!env.YOUTUBE_API_KEY)return Response.json({error:'YouTube API key is not configured.'},{status:503});
  try {
    const sources=await discoverPlaylists(env.YOUTUBE_API_KEY), unique=new Map();
    for(const source of sources){const items=await pages('playlistItems',{part:'snippet,contentDetails',playlistId:source.id},env.YOUTUBE_API_KEY);items.filter(x=>x.contentDetails?.videoId).forEach((x,position)=>{if(!unique.has(x.contentDetails.videoId))unique.set(x.contentDetails.videoId,{...x,position,playlistTitle:source.title});});}
    const entries=[...unique.values()], details=new Map();
    for(let i=0;i<entries.length;i+=50){const result=await api('videos',{part:'snippet,contentDetails,statistics',id:entries.slice(i,i+50).map(x=>x.contentDetails.videoId).join(',')},env.YOUTUBE_API_KEY);result.items.forEach(x=>details.set(x.id,x));}
    const videos=entries.map((entry,index)=>{const x=details.get(entry.contentDetails.videoId),s=x?.snippet||entry.snippet;return {id:entry.contentDetails.videoId,position:index+1,title:s.title,creator:creator(s.channelTitle),channelTitle:s.channelTitle,date:new Date(s.publishedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),ago:ago(s.publishedAt),length:duration(x?.contentDetails?.duration||'PT0S'),views:compact(x?.statistics?.viewCount),description:(s.description||'').slice(0,260),thumbnail:s.thumbnails?.high?.url||s.thumbnails?.medium?.url||'',playlist:entry.playlistTitle,official:true,verified:true};});
    return Response.json({videos,playlists:sources.map(x=>x.title),refreshedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {return Response.json({error:error.message||'Catalog refresh failed.'},{status:502});}
}
export const onRequestGet=({request,env})=>handleCatalog(request,env);
