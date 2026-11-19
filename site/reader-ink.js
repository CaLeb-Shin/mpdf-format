// Each stroke is independent, so two tabs cannot overwrite each other's drawings.
let storage
function database() {
  if (!storage) storage = new Promise((resolve, reject) => {
    const request = indexedDB.open('mpdf-reader-ink', 1)
    request.onupgradeneeded = () => {
      const strokes = request.result.createObjectStore('strokes', {keyPath:'id'})
      strokes.createIndex('score','score')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch(error => { storage = null; throw error })
  return storage
}
async function write(score, stroke, remove) {
  const db = await database()
  return new Promise((resolve,reject) => {
    const tx = db.transaction('strokes','readwrite'), table = tx.objectStore('strokes')
    if (remove) table.delete(stroke.id)
    else table.put({...stroke, score})
    tx.oncomplete = resolve
    tx.onabort = () => reject(tx.error)
  })
}
async function read(score) {
  const db = await database()
  return new Promise((resolve,reject) => {
    const request = db.transaction('strokes').objectStore('strokes').index('score').getAll(score)
    request.onsuccess = () => resolve(request.result.sort((a,b) => a.created-b.created))
    request.onerror = () => reject(request.error)
  })
}

const SVG = 'http://www.w3.org/2000/svg'
const color = '#314fb3'
const thickness = .0032
const unit = 10000
function pathFor(stroke, ratio) {
  const path = document.createElementNS(SVG,'path')
  path.setAttribute('d', stroke.points.map(([x,y], index) => (index?'L':'M')+x+' '+Math.round(y*ratio)).join(' ')+'l.01 0')
  path.dataset.stroke = stroke.id
  return path
}

export function mountInk({pages, button, tools, undo, eraser, download, share, say, notice, onDraw}) {
  let score=null, version=0, strokes=[], active=null, drawing=false, erase=false, ready=false, exporting=false
  let history=[]
  const saveProblem = () => notice(say('이 브라우저에 필기를 저장하지 못했어요. ‘필기본 저장’으로 파일을 보관하세요.','Browser storage is unavailable. Download your annotated copy to keep it.','ブラウザに保存できません。書き込み版をダウンロードしてください。'),true)
  function controls() {
    button.disabled=!ready
    button.setAttribute('aria-pressed',String(drawing))
    eraser.setAttribute('aria-pressed',String(erase))
    tools.hidden=!drawing
    undo.disabled=!history.length&&!strokes.length
    download.disabled=!strokes.length||exporting
    share.disabled=!ready||exporting||!strokes.length
    pages.classList.toggle('inking',drawing)
    pages.classList.toggle('erasing',drawing&&erase)
  }
  function setDrawing(value) {
    finish()
    drawing=value && ready
    erase=false
    if (drawing) onDraw()
    controls()
  }
  button.onclick=() => setDrawing(!drawing)
  eraser.onclick=() => { finish(); erase=!erase; controls() }
  function persist(stroke,remove=false) {
    const current=version
    if (!score) { saveProblem(); return }
    write(score,stroke,remove).catch(() => { if(current===version) saveProblem() })
  }
  function render(paper) {
    const page=Number(paper.dataset.page)
    let layer=paper.querySelector('.reader-ink')
    const list=strokes.filter(s=>s.page===page)
    if (!list.length && !layer && active?.stroke.page!==page) return
    if (!layer) {
      layer=document.createElementNS(SVG,'svg')
      layer.classList.add('reader-ink')
      layer.setAttribute('aria-hidden','true')
      layer.setAttribute('preserveAspectRatio','none')
      paper.append(layer)
    }
    const ratio=paper.clientHeight/Math.max(1,paper.clientWidth)
    layer.setAttribute('viewBox', '0 0 '+unit+' '+(unit*ratio))
    layer.setAttribute('stroke',color)
    layer.setAttribute('stroke-width',String(unit*thickness))
    layer.replaceChildren(...list.map(stroke=>pathFor(stroke,ratio)))
    if (active?.paper===paper && !active.erase) {
      active.path=pathFor(active.stroke,ratio)
      layer.append(active.path)
    }
  }
  function refresh(page) {
    const paper=pages.querySelector('.practice-paper[data-page="'+page+'"]')
    if (paper) render(paper)
    controls()
  }
  function remove(stroke) {
    strokes=strokes.filter(s=>s.id!==stroke.id)
    persist(stroke,true)
  }
  undo.onclick=() => {
    finish()
    const last=history.pop() || {stroke:strokes.at(-1),removed:false}
    if (!last.stroke) return
    if(last.removed){strokes.push(last.stroke);persist(last.stroke)}
    else remove(last.stroke)
    refresh(last.stroke.page)
  }
  function eraseAt(event) {
    const {box,stroke:current}=active
    const x=event.clientX-box.left,y=event.clientY-box.top
    if(x<0||y<0||x>box.width||y>box.height)return
    const radius=event.pointerType==='touch'?12:7
    const stroke=strokes.findLast(candidate=>{
      if(candidate.page!==current.page)return false
      let ax=candidate.points[0][0]*box.width/unit, ay=candidate.points[0][1]*box.height/unit
      return candidate.points.some(([px,py])=>{
        const bx=px*box.width/unit,by=py*box.height/unit,dx=bx-ax,dy=by-ay
        const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)))
        const hit=Math.hypot(x-ax-t*dx,y-ay-t*dy)<=radius
        ax=bx;ay=by
        return hit
      })
    })
    if(!stroke)return
    remove(stroke);history.push({stroke,removed:true});refresh(stroke.page)
  }
  function sample(event) {
    const {stroke,box}=active
    const x=Math.round(unit*Math.min(1,Math.max(0,(event.clientX-box.left)/box.width)))
    const y=Math.round(unit*Math.min(1,Math.max(0,(event.clientY-box.top)/box.height)))
    const last=stroke.points.at(-1)
    if(last && last[0]===x && last[1]===y)return
    stroke.points.push([x,y])
    active.line+='L'+x+' '+Math.round(y*box.height/box.width)+' '
  }
  pages.addEventListener('pointerdown', event=>{
    const paper=event.target.closest('.practice-paper')
    if (!ready || !paper?.querySelector('canvas') || active || event.button!==0 || !event.isPrimary) return
    if (!drawing) {
      if (event.pointerType!=='pen' || event.target.closest('button') || pages.classList.contains('placing'))return
      setDrawing(true)
    }
    event.preventDefault()
    const stroke={id:crypto.randomUUID(),page:Number(paper.dataset.page),created:Date.now(),points:[]}
    active={id:event.pointerId,paper,box:paper.getBoundingClientRect(),stroke,line:'',path:null,erase}
    pages.setPointerCapture(event.pointerId)
    if(erase){eraseAt(event);return}
    sample(event)
    active.line=active.line.replace('L','M')
    render(paper)
  })
  pages.addEventListener('pointermove', event=>{
    if(active?.id!==event.pointerId)return
    if(active.erase){eraseAt(event);return}
    const samples=event.getCoalescedEvents?.()
    for(const point of samples?.length?samples:[event])sample(point)
    active.path?.setAttribute('d',active.line+'l.01 0')
  })
  function finish() {
    if(!active)return
    const {stroke,id,paper,erase:erased}=active
    active=null
    if(pages.hasPointerCapture(id))pages.releasePointerCapture(id)
    if(!erased && stroke.points.length){
      strokes.push(stroke);history.push({stroke,removed:false});persist(stroke)
    }
    render(paper);controls()
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])pages.addEventListener(type,event=>{
    if(active?.id!==event.pointerId)return
    if(type==='pointerup'&&!active.erase)sample(event)
    finish()
  })
  window.addEventListener('pagehide',finish)
  controls()
  return {
    reset() {
      finish();version++;ready=drawing=erase=false;score=null;strokes=[];history=[];exporting=false;controls()
    },
    async open(hash) {
      const current=version
      score=hash
      let saved=[]
      if(hash)try{saved=await read(hash)}catch{if(current===version)saveProblem()}
      if(current!==version)return
      strokes=saved;ready=true
      for(const paper of pages.querySelectorAll('.practice-paper:has(canvas)'))render(paper)
      controls()
    },
    get hasStrokes(){return strokes.length>0},
    render, start:()=>setDrawing(true), stop:()=>setDrawing(false),
    async export(action, {allowEmpty=false}={}) {
      finish()
      if(!ready||exporting||(!allowEmpty&&!strokes.length))return
      const current=version
      exporting=true;controls()
      try{await action(strokes.slice(),()=>current===version)}
      finally{if(current===version){exporting=false;controls()}}
    }
  }
}

// PDF.js maps normalized points back to the original coordinate system, including
// rotated pages and crop boxes. Save standard ink annotations with a printable appearance.
export async function annotatedPDF(bytes, pdf, strokes, manifest, files) {
  const lib=await import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js')
  const {createMpdf}=await import('./mpdf-browser.js')
  // Published originals have an exact-byte creator registration. Export a practice copy.
  if(manifest){
    globalThis.PDFLib ??= lib
    bytes=await createMpdf(bytes,manifest,files,{replace:true,shared:true})
  }
  const doc=await lib.PDFDocument.load(bytes,{updateMetadata:false})
  const pages=new Map()
  for(const stroke of strokes){
    if(!pages.has(stroke.page))pages.set(stroke.page,(await pdf.getPage(stroke.page)).getViewport({scale:1}))
    const view=pages.get(stroke.page), page=doc.getPage(stroke.page-1)
    const points=stroke.points.map(([x,y])=>view.convertToPdfPoint(view.width*x/unit,view.height*y/unit))
    if(!points.length)continue
    const width=view.width*thickness/(view.userUnit||1)
    if(points.length===1)points.push([points[0][0]+.01,points[0][1]])
    const bounds=[Infinity,Infinity,-Infinity,-Infinity]
    for(const [x,y] of points){
      bounds[0]=Math.min(bounds[0],x-width);bounds[1]=Math.min(bounds[1],y-width)
      bounds[2]=Math.max(bounds[2],x+width);bounds[3]=Math.max(bounds[3],y+width)
    }
    const rgb=[49/255,79/255,179/255]
    const ops=[lib.pushGraphicsState(),lib.setStrokingRgbColor(...rgb),lib.setLineWidth(width),lib.setLineCap(1),lib.setLineJoin(1),
      lib.moveTo(...points[0]),...points.slice(1).map(([x,y])=>lib.lineTo(x,y)),lib.stroke(),lib.popGraphicsState()]
    const appearance=doc.context.register(doc.context.formXObject(ops,{BBox:bounds}))
    const annotation=doc.context.obj({Type:'Annot',Subtype:'Ink',Rect:bounds,InkList:[points.flat()],C:rgb,
      F:4,BS:{Type:'Border',W:width,S:'S'},AP:{N:appearance},NM:lib.PDFString.of(stroke.id)})
    page.node.addAnnot(doc.context.register(annotation))
  }
  return doc.save()
}
