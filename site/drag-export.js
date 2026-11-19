// Prepare the bytes before dragstart. External drops cannot wait for PDF assembly.
export function mountDragExport(anchor) {
  let file
  let objectURL
  function clear() {
    anchor.hidden = true
    anchor.removeAttribute('href')
    if (objectURL) URL.revokeObjectURL(objectURL)
    objectURL = null
    file = null
  }
  anchor.ondragstart = event => {
    if (!file || !event.dataTransfer) { event.preventDefault(); return }
    const data = event.dataTransfer
    data.clearData()
    data.effectAllowed = 'copy'
    data.setData('DownloadURL', file.type + ':' + file.name + ':' + objectURL)
    // File-aware drop targets can receive the same bytes directly.
    try { data.items.add(file) } catch {}
  }
  function prepare(bytes, name) {
    clear()
    file = new File([bytes], name, {type:'application/pdf'})
    objectURL = URL.createObjectURL(file)
    anchor.href = objectURL
    anchor.download = name
    anchor.querySelector('strong').textContent = name
    anchor.hidden = false
  }
  function save(bytes, name) {
    prepare(bytes, name)
    anchor.click()
  }
  return {prepare,save,clear}
}
