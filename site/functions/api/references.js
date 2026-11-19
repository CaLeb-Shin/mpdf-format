// Only song titles and the selected UI language are needed for discovery.
export async function onRequestGet({request, env, waitUntil}) {
  const url = new URL(request.url)
  const query = (url.searchParams.get('q') || '').normalize().trim().replace(/\s+/g, ' ')
  const lang = ['ko', 'ja'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'en'
  const failure = status => Response.json({error:'search_unavailable'}, {status, headers:{'Cache-Control':'no-store'}})
  if (!query || query.length > 200) return failure(400)
  if (!env.YOUTUBE_SEARCH_KEY) return failure(503)
  const cacheKey = new URL('/api/references', url.origin)
  cacheKey.search = new URLSearchParams({q:query, lang}).toString()
  const cache = globalThis.caches?.default
  const cached = await cache?.match(cacheKey.href)
  if (cached) return cached
  const search = new URL('https://www.googleapis.com/youtube/v3/search')
  search.search = new URLSearchParams({part:'snippet', type:'video', q:query, maxResults:'5',
    videoEmbeddable:'true', relevanceLanguage:lang, fields:'items(id/videoId,snippet(title,channelTitle))'}).toString()
  try {
    const response = await fetch(search, {headers:{'X-Goog-Api-Key':env.YOUTUBE_SEARCH_KEY}, signal:AbortSignal.timeout(10000)})
    if (!response.ok) return failure(response.status === 403 || response.status === 429 ? 503 : 502)
    const {items} = await response.json()
    const videos = items.filter(item => /^[\w-]{11}$/.test(item.id?.videoId)).map(item => ({
      id:item.id.videoId, title:item.snippet.title, channel:item.snippet.channelTitle
    }))
    const result = Response.json({videos}, {headers:{'Cache-Control':'public, max-age=3600'}})
    if (cache) waitUntil(cache.put(cacheKey.href, result.clone()))
    return result
  } catch { return failure(502) }
}
