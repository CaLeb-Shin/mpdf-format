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
