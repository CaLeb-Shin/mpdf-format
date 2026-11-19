import {mountScoreTour} from './score-tour.js'
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
let score = attachment.files[0] || null

function showAttachment() {
  filename.textContent = score?.name || ''
  filename.hidden = remove.hidden = !score
  composer.querySelector('.attach-label').hidden = !!score
}
function setScore(file) {
  score = file
  attachment.value = ''
  dropError.hidden = true
  showAttachment()
}
const invalid = () => { dropError.hidden = false }
attachment.onchange = () => {
  if (isScorePDF(attachment.files[0])) setScore(attachment.files[0])
  else if (attachment.files.length) invalid()
}
mountScoreDrop(document, composer, {select:setScore, invalid, enabled:() => !submit.disabled})
remove.onclick = () => { setScore(null); attachment.focus() }
window.addEventListener('pageshow', () => { submit.disabled = false; preparing.hidden = true; showAttachment() })
composer.onsubmit = async event => {
  event.preventDefault()
  if (submit.disabled) return
  if (!input.value.trim()) { input.value = ''; input.reportValidity(); return }
  error.hidden = true
  preparing.hidden = false
  submit.disabled = true
  try {
    const draft = await storeSetlist(input.value.trim(), score)
    location.assign('/make/?' + new URLSearchParams({start:'setlist', draft, lang:getLang()}))
  } catch {
    error.hidden = false
    preparing.hidden = true
    submit.disabled = false
  }
}
