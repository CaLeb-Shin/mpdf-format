// Handle files only so dragging text and links into a textarea still works.
export function mountScoreDrop(target, highlight, {select, invalid, enabled = () => true}) {
  const hasFiles = event => Array.from(event.dataTransfer?.types || []).includes('Files')
  function dragOver(event) {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = enabled() ? 'copy' : 'none'
    highlight.classList.toggle('score-dragging', enabled())
  }
  function clear() { highlight.classList.remove('score-dragging') }
  target.addEventListener('dragenter', dragOver)
  target.addEventListener('dragover', dragOver)
  target.addEventListener('dragleave', event => {
    if (!event.relatedTarget || !target.contains(event.relatedTarget)) clear()
  })
  target.addEventListener('drop', event => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.stopPropagation()
    clear()
    if (!enabled()) return
    const files = event.dataTransfer.files
    if (files.length === 1 && isScorePDF(files[0])) select(files[0])
    else invalid()
  })
}

export const isScorePDF = file => file && file.size > 0 && (file.type === 'application/pdf' || /\.m?pdf$/i.test(file.name))
