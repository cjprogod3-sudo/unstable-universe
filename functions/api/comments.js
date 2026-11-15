const YT = 'https://www.googleapis.com/youtube/v3';
const SEED_PLAYLIST = 'PLzdPgQvHT2bpN6XE_i_SnTErvBtKycHwg';

const duration = value => { const m=value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/),h=Number(m?.[1]||0),min=Number(m?.[2]||0),sec=Number(m?.[3]||0);return h?`${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${min}:${String(sec).padStart(2,'0')}`; };
const ago = iso => {const d=Math.max(1,Math.floor((Date.now()-new Date(iso))/86400000));return d<30?`${d} days ago`:d<365?`${Math.floor(d/30)} months ago`:`${Math.floor(d/365)} years ago`;};
const compact = n => new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(Number(n||0));
const creator = title => /wemmbu/i.test(title)?'Wemmbu':/parrot/i.test(title)?'Parrot':/spoke/i.test(title)?'Spoke':/flamefrags/i.test(title)?'FlameFrags':title;

async function api(path, params, key) {
  const url=new URL(`${YT}/${path}`);
  url.search=new URLSearchParams({...params,key});
  const response=await fetch(url);
  if(!response.ok) throw new Error(`YouTube ${path} request failed (${response.status})`);
  return response.json();
}

// This is the official all-videos playlist supplied for this fan site. Each
// page is read separately below, so future entries are found without exceeding
// Cloudflare's per-request subrequest limit.
const officialSource = () => [{id:SEED_PLAYLIST,title:'Unstable Universe — official playlist'}];

function json(value, status=200) {
  return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
}

async function catalogPage(playlistId, pageToken, key) {
  const page=await api('playlistItems',{
    part:'snippet,contentDetails', playlistId, maxResults:'50', ...(pageToken?{pageToken}:{})
  },key);
  const entries=(page.items||[]).filter(item=>item.contentDetails?.videoId);
  const ids=entries.map(item=>item.contentDetails.videoId);
  const details=new Map();
  if(ids.length) {
    const response=await api('videos',{part:'snippet,contentDetails,statistics',id:ids.join(',')},key);
    response.items?.forEach(item=>details.set(item.id,item));
  }
  const videos=entries.map((entry,index)=>{
    const item=details.get(entry.contentDetails.videoId), snippet=item?.snippet||entry.snippet;
    return {
      id:entry.contentDetails.videoId,
      position:index+1,
      title:snippet.title,
      creator:creator(snippet.channelTitle),
      channelTitle:snippet.channelTitle,
      date:new Date(snippet.publishedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}),
      ago:ago(snippet.publishedAt),
      length:duration(item?.contentDetails?.duration||'PT0S'),
      views:compact(item?.statistics?.viewCount),
      description:(snippet.description||'').slice(0,260),
      thumbnail:snippet.thumbnails?.high?.url||snippet.thumbnails?.medium?.url||'',
      official:true,
      verified:true
    };
  });
  return {videos,nextPageToken:page.nextPageToken||null};
}

export async function handleCatalog(request, env) {
  if(!env.YOUTUBE_API_KEY) return json({error:'YouTube API key is not configured.'},503);
  const url=new URL(request.url);
  try {
    if(url.searchParams.get('mode')==='discover') {
      return json({sources:officialSource(),refreshedAt:new Date().toISOString()});
    }
    const playlistId=url.searchParams.get('playlistId');
    if(!playlistId) return json({error:'playlistId is required.'},400);
    const data=await catalogPage(playlistId,url.searchParams.get('pageToken')||'',env.YOUTUBE_API_KEY);
    return json({...data,playlistId,refreshedAt:new Date().toISOString()});
  } catch(error) {
    return json({error:error.message||'Catalog refresh failed.'},502);
  }
}

export const onRequestGet=({request,env})=>handleCatalog(request,env);
