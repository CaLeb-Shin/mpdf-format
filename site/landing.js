import {storeSetlist} from './file-session.js'
import {mountLangButton,getLang} from './i18n.js';
mountLangButton();
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

function showAttachment() {
  const file = attachment.files[0]
  filename.textContent = file?.name || ''
  filename.hidden = remove.hidden = !file
  composer.querySelector('.attach-label').hidden = !!file
}
attachment.onchange = showAttachment
remove.onclick = () => { attachment.value = ''; showAttachment(); attachment.focus() }
window.addEventListener('pageshow', () => { submit.disabled = false; showAttachment() })
composer.onsubmit = async event => {
  event.preventDefault()
  if (submit.disabled) return
  if (!input.value.trim()) { input.value = ''; input.reportValidity(); return }
  error.hidden = true
  submit.disabled = true
  try {
    const draft = await storeSetlist(input.value.trim(), attachment.files[0] || null)
    location.assign('/make/?' + new URLSearchParams({start:'setlist', draft, lang:getLang()}))
  } catch {
    error.hidden = false
    submit.disabled = false
  }
}
