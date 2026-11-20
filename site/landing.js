import {mountScoreTour} from './score-tour.js'
import {highlightSetlistStep} from './setlist-steps.js'
import {storeSetlist} from './file-session.js'
import {isScorePDF, mountScoreDrop} from './score-drop.js'
import {mountLangButton,getLang} from './i18n.js';
mountLangButton();
mountScoreTour(document.querySelector('.score-tour'));
const file=new URLSearchParams(location.search).get('file');
if(file){const url=new URL(file,location.href);location.replace('/make/?file='+encodeURIComponent(url.href));}
if(location.hash==='#tool')location.replace('/make/');

function applyLinkLanguage(){
  for(const a of document.querySelectorAll('a[href^="/make/"],a[href^="/v/"]')){
    const url=new URL(a.href)
    url.searchParams.set('lang',getLang())
    a.href=url.pathname+url.search
  }
}
applyLinkLanguage()
document.addEventListener('langchange',applyLinkLanguage)

const composer = document.getElementById('home-setlist')
const input = document.getElementById('home-text')
const attachment = document.getElementById('home-pdf')
const filename = document.getElementById('home-filename')
const remove = document.getElementById('remove-pdf')
const submit = composer.querySelector('[type=submit]')
const error = document.getElementById('handoff-error')
const dropError = document.getElementById('home-drop-error')
const preparing = document.getElementById('home-preparing')
const skip = document.getElementById('home-skip')
let score = attachment.files[0] || null
let transferring = false

function refresh() {
  const hasSource = Boolean(score) || skip.checked
  highlightSetlistStep(composer, hasSource, input.value)
  input.disabled = transferring || !hasSource
  submit.disabled = input.disabled || !input.value.trim()
  attachment.disabled = remove.disabled = skip.disabled = transferring
  preparing.hidden = !transferring
  const name = score?.name || ''
  if (filename.textContent !== name) filename.textContent = name
  filename.hidden = remove.hidden = !score
  document.getElementById('home-skip-option').hidden = Boolean(score)
  composer.querySelector('.attach-label').hidden = Boolean(score)
}
function setScore(file) {
  score = file
  skip.checked = false
  attachment.value = ''
  dropError.hidden = error.hidden = true
  refresh()
}
const invalid = () => { dropError.hidden = false }
attachment.onchange = () => {
  if (isScorePDF(attachment.files[0])) setScore(attachment.files[0])
  else if (attachment.files.length) { attachment.value = ''; invalid() }
}
mountScoreDrop(document, composer.querySelector('.attachment'), {select:setScore, invalid, enabled:() => !transferring})
remove.onclick = () => { setScore(null); attachment.focus() }
skip.onchange = () => { dropError.hidden = error.hidden = true; refresh() }
input.oninput = () => { error.hidden = true; refresh() }
window.addEventListener('pageshow', () => { transferring = false; refresh() })
refresh()
composer.onsubmit = async event => {
  event.preventDefault()
  if (transferring || (!score && !skip.checked) || !input.value.trim()) return
  error.hidden = true
  transferring = true
  refresh()
  try {
    const draft = await storeSetlist(input.value.trim(), score)
    location.assign('/make/?' + new URLSearchParams({start:'setlist', draft, lang:getLang()}))
  } catch {
    error.hidden = false
    transferring = false
    refresh()
  }
}
