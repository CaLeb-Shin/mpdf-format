import assert from 'node:assert/strict'
import {parseSetlist} from '../setlist.js'
import {onRequestGet} from '../functions/api/references.js'

import {locateTitles} from '../score-titles.js'
const heading = (text,top=.09) => ({text,top,bottom:top+.03,left:.3,right:.65,priority:1})
const printed = [[heading('첫 곡')],[heading('주는 나를 기르시는 목자')],[heading('주는 나름 기르시는 목자')],[heading('마지막 곡')]]
assert.deepEqual(locateTitles([{name:'첫 곡'},{name:'주는 나를 기르시는 목자요'},{name:'마지막 곡'}],printed).map(group=>group.map(m=>m.page)), [[1],[2,3],[4]])
assert.deepEqual(locateTitles([{name:'없는 제목'}],printed),[[]])
const text = `260101_합주 연습

1.캐논(전주만 연습)
https://youtu.be/AAAAAAAAAAA?si=example
2.아리랑
https://youtu.be/BBBBBBBBBBB?si=example
3.봄
https://youtu.be/CCCCCCCCCCC?si=example
4.달빛
https://youtu.be/DDDDDDDDDDD?si=example
5.작은 별 + 환희의 송가`
const parsed = parseSetlist(text)
assert.equal(parsed.title, '260101_합주 연습')
assert.equal(parsed.songs[0].note, '전주만 연습')
assert.deepEqual(parsed.songs.map(s => s.video), ['AAAAAAAAAAA','BBBBBBBBBBB','CCCCCCCCCCC','DDDDDDDDDDD',null])
assert.equal(parsed.songs[4].name, '작은 별 + 환희의 송가')
assert.equal(parseSetlist('Canon\nArirang').songs.length, 2)
assert.equal(parseSetlist('Rehearsal\n\nCanon\nArirang').title, 'Rehearsal')
assert.equal(parseSetlist('1) Canon https://www.youtube.com/watch?v=AAAAAAAAAAA').songs[0].video, 'AAAAAAAAAAA')
assert.equal(parseSetlist('https://youtu.be/AAAAAAAAAAA').songs[0].fromLink,true)
assert.equal(parseSetlist('1. Canon\nhttps://youtu.be/AAAAAAAAAAA').songs[0].name,'Canon')
assert.equal(parseSetlist('Canon\nhttps://youtu.be/AAAAAAAAAAA').songs[0].name,'Canon')
assert.deepEqual(parseSetlist('Rehearsal\n1. https://youtu.be/AAAAAAAAAAA\n2. https://youtu.be/BBBBBBBBBBB').songs.map(s=>s.video),['AAAAAAAAAAA','BBBBBBBBBBB'])
assert.throws(() => parseSetlist(Array(61).fill('Arirang').join('\n')), /size/)
const request = new Request('https://example.org/api/references?q=Arirang')
assert.equal((await onRequestGet({request, env:{}})).status, 503)
assert.equal((await onRequestGet({request:new Request('https://example.org/api/references'), env:{}})).status, 400)
const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get('q'), 'Arirang')
    assert.equal(url.searchParams.get('videoEmbeddable'), 'true')
    assert.equal(options.headers['X-Goog-Api-Key'], 'test')
    return Response.json({items:[{id:{videoId:'AAAAAAAAAAA'},snippet:{title:'A',channelTitle:'B'}}]})
  }
  assert.deepEqual(await (await onRequestGet({request, env:{YOUTUBE_SEARCH_KEY:'test'}})).json(), {videos:[{id:'AAAAAAAAAAA',title:'A',channel:'B'}]})
} finally { globalThis.fetch = originalFetch }
console.log('Setlist parsing and reference lookup tests passed')
