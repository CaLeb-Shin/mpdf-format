import {scoreCanvas} from './score-titles.js'

// Used only for titles whose printed position could not be identified.
export async function pickScorePosition(pdf, song, startPage, signal) {
  const dialog = document.getElementById('position-dialog')
  const select = dialog.querySelector('select'), preview = dialog.querySelector('.position-preview')
  dialog.querySelector('strong').textContent = song.name
  select.replaceChildren(...Array.from({length:pdf.numPages},(_,i)=>new Option(String(i+1),i+1)))
  select.value = String(startPage)
  let revision = 0
  return new Promise((resolve,reject) => {
    function done(value, error) {
      ++revision
      signal.removeEventListener('abort', cancel)
      dialog.oncancel = select.onchange = preview.onclick = null
      dialog.close()
      preview.replaceChildren()
      if (error) reject(error)
      else resolve(value)
    }
    const cancel = () => done(null,new DOMException('Cancelled','AbortError'))
    dialog.querySelector('button').onclick = cancel
    dialog.oncancel = e => { e.preventDefault(); cancel() }
    signal.addEventListener('abort',cancel,{once:true})
    async function display() {
      const version = ++revision
      preview.replaceChildren()
      try {
        const canvas = await scoreCanvas(pdf,Number(select.value),760)
        if (version!==revision) return
        preview.append(canvas)
      } catch(e) { if (version===revision) done(null,e) }
    }
    preview.onclick = event => {
      if (event.target.tagName!=='CANVAS') return
      const r = event.target.getBoundingClientRect()
      const limit = v=>Math.max(.05,Math.min(.95,v))
      done({page:Number(select.value),x:limit((event.clientX-r.left)/r.width),y:limit((event.clientY-r.top)/r.height)})
    }
    select.onchange = display
    dialog.showModal()
    display()
  })
}
