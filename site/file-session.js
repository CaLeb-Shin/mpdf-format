// Browser-local handoff between the home page, maker and preview.
const NAME = 'mpdf-local-workspace-v1'
const TTL = 86400000

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files', {keyPath:'id'})
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function save(record, id = crypto.randomUUID(), expiresAt = Date.now() + TTL) {
  const db = await database()
  try {
    const created = Date.now()
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      const store = tx.objectStore('files')
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const row = cursor.result
        if (!row) return
        const old = row.value
        const expired = created >= (old.expiresAt ?? old.created + TTL)
        const replacedPreview = !old.kind && !record.kind && record.name && old.name === record.name
        if (old.id !== id && (expired || replacedPreview)) row.delete()
        row.continue()
      }
      store.put({...record, id, created, expiresAt})
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error)
    })
    return id
  } finally { db.close() }
}

async function read(id, kind) {
  if (kind !== 'original' && !/^[a-f0-9-]{36}$/i.test(id || '')) return null
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite')
      const store = tx.objectStore('files')
      const request = store.get(id)
      let record = null
      request.onsuccess = () => {
        const row = request.result
        if (!row) return
        if (Date.now() >= (row.expiresAt ?? row.created + TTL)) { store.delete(id); return }
        if (row.kind !== kind) return
        record = row
        if (kind === 'setlist') store.delete(id)
      }
      tx.oncomplete = () => resolve(record)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

export function storeFile(file) { return save({file, name:file.name}) }
export async function loadFile(id) {
  const row = await read(id)
  return row && new File([row.file], row.name, {type:'application/pdf'})
}
export function storeSetlist(text, score) { return save({kind:'setlist', text, score}) }
export function takeSetlist(id) { return read(id, 'setlist') }

// Only the shareable PDF is uploaded. This browser keeps the author's saved original.
export function rememberOriginal(id, file, expiresAt) {
  if (!/^[A-Za-z0-9]{8,16}$/.test(id) || !Number.isFinite(Date.parse(expiresAt))) throw new Error('Invalid share link')
  return save({kind:'original',file}, 'original:'+id, Date.parse(expiresAt))
}
export async function originalForLink(id) {
  if (!/^[A-Za-z0-9]{8,16}$/.test(id)) return null
  return (await read('original:'+id, 'original'))?.file ?? null
}
