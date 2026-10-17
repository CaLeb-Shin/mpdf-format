import {mountLangButton} from './i18n.js';
mountLangButton();
const file=new URLSearchParams(location.search).get('file');
if(file){const url=new URL(file,location.href);location.replace('/make/?file='+encodeURIComponent(url.href));}
if(location.hash==='#tool')location.replace('/make/');
async function preview(){try{const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument('/samples/practice.mpdf').promise;const page=await pdf.getPage(1),vp=page.getViewport({scale:1.15}),c=document.getElementById('hero-score');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;await pdf.destroy();}catch{document.getElementById('hero-score').style.visibility='hidden';}}
preview();
