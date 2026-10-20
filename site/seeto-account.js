/** SEETO creator accounts. Public config; authorization stays in Firebase rules.
 * The PDF's creatorUID is a claim. Only the immutable registry for its exact
 * SHA-256 can authorize an imported creator original. No browser receipt cache.
 */
const FIREBASE_CONFIG = Object.freeze({
  projectId: 'seetogether-app-2026',
  appId: '1:19573779670:web:a1e9ab8d64ab1c8adfad77',
  apiKey: 'AIzaSyAVlKcDziXXZ1soMlrZLW1z19M44WznCoU',
  authDomain: 'seetogether-app-2026.firebaseapp.com',
  storageBucket: 'seetogether-app-2026.firebasestorage.app',
  messagingSenderId: '19573779670',
})
// Enabled providers verified against the deployed SEETO Auth configuration.
// Apple needs separate web OAuth provisioning before it can be offered here.
const SUPPORTED_PROVIDERS = Object.freeze(['google'])
const SDK = 'https://www.gstatic.com/firebasejs/12.9.0'
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const HASH = /^[a-f0-9]{64}$/
const MAX_BYTES = 512 * 1024 * 1024
const SWIFT_EPOCH = 978307200 // Foundation Date's default JSON encoding: 2001-01-01.
const MESSAGES = {
  ko: {
    signIn: 'SEETO 계정', signedIn: '계정', title: 'SEETO 계정 연결', close: '닫기',
    intro: 'SEETO에서 쓰는 Google 계정으로 로그인하세요. 제작자 원본을 확인하고 새 MPDF의 제작자 정보를 등록할 수 있어요.',
    providerNote: '웹에서는 Google 연결 계정을 지원합니다. Apple 전용 계정의 원본 수정은 SEETO 앱을 이용해 주세요.',
    privacy: '제작자 등록에는 파일의 SHA-256 해시와 계정 ID를 저장합니다. 이 과정에서 악보·음원은 업로드하지 않아요.',
    readOnly: '받은 공유본은 로그인해도 읽기 전용으로 유지됩니다.',
    google: 'Google로 계속', apple: 'Apple로 계속', signOut: '로그아웃',
    preparing: '계정 연결을 준비하고 있어요…', working: '계정을 연결하고 있어요…',
    connected: 'SEETO 계정이 연결되었습니다.', signedOut: '로그아웃했습니다.',
    accountName: 'SEETO 사용자', retry: '다시 연결',
    'sign-in-required': '제작자 등록·원본 수정은 SEETO 계정에 로그인한 뒤 이용해 주세요.',
    'unknown-creator': '제작자 확인 정보가 없는 이전 MPDF입니다. 받은 파일은 읽기 전용으로 열립니다.',
    'not-creator': '이 MPDF를 만든 SEETO 계정으로 로그인해 주세요.',
    'invalid-publication': 'MPDF 파일과 제작자 등록 정보가 일치하지 않습니다. 원본은 그대로 보존됩니다.',
    'shared-read-only': '공유용 MPDF는 읽기 전용입니다. 수정하려면 제작자 원본 MPDF를 열어 주세요.',
    'account-changed': '로그인 계정이 바뀌었습니다. 현재 계정으로 다시 시도해 주세요.',
    'verification-unavailable': '제작자 정보를 확인하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
    'auth/unauthorized-domain': '이 사이트의 SEETO 로그인 연결이 아직 승인되지 않았습니다. 제작자 등록은 연결 설정 후 사용할 수 있어요.',
    'auth/operation-not-allowed': '이 로그인 방식의 웹 연결이 아직 설정되지 않았습니다. 다른 로그인 방식을 이용해 주세요.',
    'auth/invalid-oauth-client-id': 'Apple 웹 로그인 연결 설정을 확인해야 합니다. 다른 로그인 방식을 이용해 주세요.',
    'auth/invalid-credential': '로그인 인증을 완료하지 못했어요. 다시 로그인하거나 다른 방식을 이용해 주세요.',
    'auth/popup-blocked': '브라우저에서 로그인 팝업을 허용한 뒤 다시 눌러 주세요.',
    'auth/popup-closed-by-user': '로그인을 완료하기 전에 창 연결이 끊겼습니다. 다시 연결해 주세요.',
    'auth/cancelled-popup-request': '다른 로그인 요청이 시작되었습니다. 열린 로그인 창을 확인해 주세요.',
    'auth/account-exists-with-different-credential': '이 이메일은 다른 로그인 방식으로 등록되어 있습니다. SEETO에서 사용하던 방식으로 로그인해 주세요.',
    'auth/network-request-failed': '로그인 서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
    'auth/web-storage-unsupported': '브라우저에서 계정 저장소를 사용할 수 없습니다. 일반 브라우저 창에서 다시 시도해 주세요.',
    'auth/too-many-requests': '로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
    unavailable: '계정 연결을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
  },
  ja: {
    signIn: 'SEETOアカウント', signedIn: 'アカウント', title: 'SEETOアカウントを連携', close: '閉じる',
    intro: 'SEETOで使っているGoogleアカウントでサインインしてください。作成者オリジナルの確認と、新しいMPDFの作成者情報の登録ができます。',
    providerNote: 'ウェブではGoogle連携アカウントに対応しています。Appleのみのアカウントでは、SEETOアプリでオリジナルを編集してください。',
    privacy: '作成者登録ではファイルのSHA-256ハッシュとアカウントIDを保存します。この手順で楽譜や音源はアップロードされません。',
    readOnly: '受け取った共有用コピーは、サインインしても読み取り専用のままです。',
    google: 'Googleで続ける', apple: 'Appleで続ける', signOut: 'サインアウト',
    preparing: 'アカウント連携を準備しています…', working: 'アカウントを連携しています…',
    connected: 'SEETOアカウントを連携しました。', signedOut: 'サインアウトしました。',
    accountName: 'SEETOユーザー', retry: '再接続',
    'sign-in-required': '作成者登録やオリジナルの編集には、SEETOアカウントへのサインインが必要です。',
    'unknown-creator': '作成者情報を確認できない以前のMPDFです。読み取り専用で開きます。',
    'not-creator': 'このMPDFを作成したSEETOアカウントでサインインしてください。',
    'invalid-publication': 'このファイルは作成者登録と一致しません。オリジナルはそのまま保持されます。',
    'shared-read-only': '共有用MPDFは読み取り専用です。編集するには作成者オリジナルを開いてください。',
    'account-changed': 'サインイン中のアカウントが変わりました。現在のアカウントでもう一度お試しください。',
    'verification-unavailable': '作成者情報を確認できませんでした。インターネット接続を確認して、もう一度お試しください。',
    'auth/unauthorized-domain': 'このサイトのSEETOサインイン連携はまだ承認されていません。作成者登録は設定後に使えます。',
    'auth/operation-not-allowed': 'このサインイン方法はウェブ用に設定されていません。別の方法をお試しください。',
    'auth/invalid-oauth-client-id': 'Appleのウェブサインインの設定確認が必要です。別のサインイン方法をお試しください。',
    'auth/invalid-credential': 'サインインを完了できませんでした。もう一度お試しいただくか、別の方法を使ってください。',
    'auth/popup-blocked': 'ブラウザーでサインインのポップアップを許可してから、もう一度押してください。',
    'auth/popup-closed-by-user': 'サインインが完了する前にウィンドウとの接続が切れました。もう一度連携してください。',
    'auth/cancelled-popup-request': '別のサインイン要求が始まりました。開いているサインイン画面を確認してください。',
    'auth/account-exists-with-different-credential': 'このメールアドレスは別のサインイン方法で登録されています。SEETOで使っている方法でサインインしてください。',
    'auth/network-request-failed': 'サインインサーバーに接続できません。インターネット接続を確認してください。',
    'auth/web-storage-unsupported': 'このブラウザーではアカウントの保存領域を使えません。通常のブラウザーウィンドウでお試しください。',
    'auth/too-many-requests': 'サインインの試行が多すぎます。しばらくしてからお試しください。',
    unavailable: 'アカウント連携を読み込めませんでした。インターネット接続を確認して、もう一度お試しください。',
  },
  en: {
    signIn: 'SEETO account', signedIn: 'Account', title: 'Connect your SEETO account', close: 'Close',
    intro: 'Sign in with the Google account you use in SEETO to verify creator originals and register new MPDF publications.',
    providerNote: 'The website supports Google-connected accounts. For an Apple-only account, revise creator originals in the SEETO app.',
    privacy: 'Creator registration stores a SHA-256 file hash and account ID. It does not upload the score or audio.',
    readOnly: 'Shared read-only copies stay read-only after sign-in.',
    google: 'Continue with Google', apple: 'Continue with Apple', signOut: 'Sign out',
    preparing: 'Preparing account connection…', working: 'Connecting your account…',
    connected: 'Your SEETO account is connected.', signedOut: 'You have signed out.',
    accountName: 'SEETO user', retry: 'Reconnect',
    'sign-in-required': 'Sign in to your SEETO account to register a creator original or make a revision.',
    'unknown-creator': 'This older MPDF has no verifiable creator information. It opens read-only.',
    'not-creator': 'Sign in with the SEETO account that created this MPDF.',
    'invalid-publication': 'This file does not match its creator registration. The original is preserved.',
    'shared-read-only': 'Shared MPDF copies are read-only. Open the creator original to make a revision.',
    'account-changed': 'Your signed-in account changed. Try again with the current account.',
    'verification-unavailable': 'Creator information could not be verified. Check your internet connection and try again.',
    'auth/unauthorized-domain': 'SEETO sign-in has not been approved for this site yet. Creator registration needs this connection setup.',
    'auth/operation-not-allowed': 'This sign-in method has not been configured for the web. Try another method.',
    'auth/invalid-oauth-client-id': 'Apple web sign-in needs configuration. Try another sign-in method.',
    'auth/invalid-credential': 'Sign-in could not be completed. Try again or use another sign-in method.',
    'auth/popup-blocked': 'Allow sign-in popups in your browser, then try again.',
    'auth/popup-closed-by-user': 'The sign-in window connection ended before sign-in completed. Please reconnect.',
    'auth/cancelled-popup-request': 'Another sign-in request started. Check the open sign-in window.',
    'auth/account-exists-with-different-credential': 'This email uses another sign-in method. Use the same method you use in SEETO.',
    'auth/network-request-failed': 'Unable to reach the sign-in server. Check your internet connection.',
    'auth/web-storage-unsupported': 'Account storage is unavailable in this browser. Try a regular browser window.',
    'auth/too-many-requests': 'Too many sign-in attempts. Please try again later.',
    unavailable: 'Account connection could not load. Check your internet connection and try again.',
  },
}

export class SeetoAccountError extends Error {
  constructor(code, lang = 'en') {
    super(accountErrorMessage({ code }, lang))
    this.name = 'SeetoAccountError'
    this.code = code
  }
}

export function accountErrorMessage(error, lang = 'en') {
  const text = MESSAGES[lang] || MESSAGES.en
  return text[error?.code] || text.unavailable
}

function validUID(value) {
  return typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).length <= 128
}

function logAuthFailure(error) {
  // Never log the error object: OAuth failures can contain credentials or URLs.
  const code = typeof error?.code === 'string' && /^auth\/[a-z0-9-]{1,80}$/.test(error.code)
    ? error.code : 'auth/unknown'
  console.warn('SEETO account connection failed:', code)
}

function validPublication(value) {
  return value && value.version === 1 && typeof value.id === 'string' && UUID.test(value.id)
    && validUID(value.creatorUID)
    && (value.sharedReadOnly == null || typeof value.sharedReadOnly === 'boolean')
}

function readRecord(snapshot) {
  const value = snapshot.data()
  if (!value || value.schemaVersion !== 1 || !HASH.test(value.sha256) || value.sha256 !== snapshot.id
    || !UUID.test(value.publicationID) || !validUID(value.ownerUID)
    || typeof value.createdAt?.toMillis !== 'function' || !Number.isFinite(value.createdAt.toMillis())) return null
  return Object.freeze({ sha256: value.sha256, publicationID: value.publicationID, ownerUID: value.ownerUID })
}

function sameRecord(a, b) {
  return a && b && a.sha256 === b.sha256 && a.publicationID === b.publicationID && a.ownerUID === b.ownerUID
}

export async function sha256Bytes(bytes) {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes)
    : ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : null
  if (!view || view.byteLength === 0 || view.byteLength > MAX_BYTES) throw new SeetoAccountError('invalid-publication')
  if (!globalThis.crypto?.subtle) throw new SeetoAccountError('verification-unavailable')
  const hash = await crypto.subtle.digest('SHA-256', view)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * ready() resolves when the saved login has been restored. onChange receives a
 * safe {uid, displayName, email} object or null. mount(element) returns cleanup.
 * verify() / register() return {sha256, publicationID, ownerUID}; neither grants
 * permission based only on embedded metadata. Always await register before
 * offering the finished creator file for download.
 */
export function createSeetoAccount({ lang = document.documentElement.lang } = {}) {
  lang = MESSAGES[lang] ? lang : 'en'
  let text = MESSAGES[lang]
  const listeners = new Set(), languageViews = new Set()
  let sdk, auth, db, loading, user = null, epoch = 0, lastIdentity = null, authChanging = false
  const fail = code => new SeetoAccountError(code, lang)
  const notify = () => {
    for (const listener of listeners) {
      try { listener(user) } catch (error) { console.error('SEETO account listener failed', error?.name || 'Error') }
    }
  }
  function updateUser(value) {
    const identity = value && !value.isAnonymous && validUID(value.uid) ? value.uid : null
    if (lastIdentity !== identity) epoch++
    lastIdentity = identity
    user = identity && !authChanging ? Object.freeze({ uid: identity, displayName: value.displayName || '', email: value.email || '' }) : null
    notify()
  }
  async function ready() {
    if (!loading) {
      loading = (async () => {
        const [appSDK, authSDK, firestoreSDK] = await Promise.all([
          import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
        ])
        sdk = { ...authSDK, ...firestoreSDK }
        const app = appSDK.getApps().find(value => value.name === 'mpdf-seeto') || appSDK.initializeApp(FIREBASE_CONFIG, 'mpdf-seeto')
        if (app.options.projectId !== 'seetogether-app-2026') throw fail('verification-unavailable')
        auth = sdk.getAuth(app)
        auth.languageCode = lang
        db = sdk.getFirestore(app)
        await new Promise((resolve, reject) => {
          let first = true
          sdk.onAuthStateChanged(auth, value => {
            updateUser(value)
            if (first) { first = false; resolve() }
          }, reject)
        })
        return user
      })().catch(error => { loading = null; throw error instanceof SeetoAccountError ? error : fail('verification-unavailable') })
    }
    await loading
    return user
  }
  function currentUID(expected) {
    if (authChanging) throw fail('account-changed')
    const current = auth?.currentUser
    if (!current || current.isAnonymous || !validUID(current.uid)) throw fail('sign-in-required')
    if (expected != null && current.uid !== expected) throw fail('account-changed')
    return current.uid
  }
  function ensureStable(uid, generation) {
    if (generation !== epoch) throw fail('account-changed')
    currentUID(uid)
  }
  function online() {
    if (globalThis.navigator?.onLine === false) throw fail('verification-unavailable')
  }
  async function requireAccount(expectedUID) {
    await ready()
    return currentUID(expectedUID)
  }
  async function signIn(provider = 'google') {
    await ready()
    if (!SUPPORTED_PROVIDERS.includes(provider)) throw fail('auth/operation-not-allowed')
    if (authChanging) throw fail('account-changed')
    authChanging = true
    user = null
    notify()
    epoch++ // A new login attempt invalidates an in-flight edit authorization.
    const handler = new sdk.GoogleAuthProvider()
    handler.setCustomParameters({ prompt: 'select_account' })
    try {
      const result = await sdk.signInWithPopup(auth, handler)
      authChanging = false
      updateUser(result.user)
      return user
    } catch (error) {
      authChanging = false
      updateUser(auth.currentUser)
      logAuthFailure(error)
      throw fail(typeof error?.code === 'string' ? error.code : 'verification-unavailable')
    }
  }
  async function signOut() {
    await ready()
    if (authChanging) throw fail('account-changed')
    authChanging = true
    epoch++
    // Notify immediately so a currently open editor drops its authorization.
    user = null
    notify()
    try { await sdk.signOut(auth); authChanging = false; updateUser(null) }
    catch (error) { authChanging = false; updateUser(auth.currentUser); logAuthFailure(error); throw fail('verification-unavailable') }
  }
  async function verify(bytes, publication) {
    if (publication?.sharedReadOnly === true) throw fail('shared-read-only')
    if (!publication?.creatorUID) throw fail('unknown-creator')
    if (!validPublication(publication)) throw fail('invalid-publication')
    const claim = { id: publication.id, creatorUID: publication.creatorUID }
    const uid = await requireAccount()
    if (claim.creatorUID !== uid) throw fail('not-creator')
    const generation = epoch
    online()
    const sha256 = await sha256Bytes(bytes)
    ensureStable(uid, generation)
    try {
      const snapshot = await sdk.getDocFromServer(sdk.doc(db, 'mpdfPublications', sha256))
      ensureStable(uid, generation)
      const record = snapshot.exists() ? readRecord(snapshot) : null
      if (!sameRecord(record, { sha256, publicationID: claim.id, ownerUID: uid })) throw fail('invalid-publication')
      return record
    } catch (error) {
      ensureStable(uid, generation)
      throw error instanceof SeetoAccountError ? error : fail('verification-unavailable')
    }
  }
  async function register(bytes, publication) {
    if (!validPublication(publication)) throw fail('invalid-publication')
    const claim = { id: publication.id, creatorUID: publication.creatorUID }
    const uid = await requireAccount(claim.creatorUID)
    const generation = epoch
    online()
    const sha256 = await sha256Bytes(bytes)
    ensureStable(uid, generation)
    const record = Object.freeze({ sha256, publicationID: claim.id, ownerUID: uid })
    try {
      const reference = sdk.doc(db, 'mpdfPublications', sha256)
      await sdk.runTransaction(db, async transaction => {
        ensureStable(uid, generation)
        const existing = await transaction.get(reference)
        ensureStable(uid, generation)
        if (existing.exists()) {
          if (!sameRecord(readRecord(existing), record)) throw fail('invalid-publication')
        } else {
          transaction.set(reference, { schemaVersion: 1, ...record, createdAt: sdk.serverTimestamp() })
        }
      })
      ensureStable(uid, generation)
      return record
    } catch (error) {
      ensureStable(uid, generation)
      throw error instanceof SeetoAccountError ? error : fail('verification-unavailable')
    }
  }
  async function createPublication(fields = {}) {
    const uid = await requireAccount()
    if (!globalThis.crypto?.randomUUID) throw fail('verification-unavailable')
    return {
      ...fields,
      version: 1,
      id: crypto.randomUUID().toUpperCase(),
      sourceNoteID: typeof fields.sourceNoteID === 'string' && fields.sourceNoteID ? fields.sourceNoteID : `pdf-${crypto.randomUUID().toUpperCase()}`,
      createdAt: Date.now() / 1000 - SWIFT_EPOCH,
      tempo: Number.isInteger(fields.tempo) && fields.tempo > 0 && fields.tempo <= 400 ? fields.tempo : 80,
      sourceStartSeconds: Number.isFinite(fields.sourceStartSeconds) && fields.sourceStartSeconds >= 0 && fields.sourceStartSeconds <= 86400 ? fields.sourceStartSeconds : 0,
      creatorUID: uid,
    }
  }
  function setLang(value) {
    lang = MESSAGES[value] ? value : 'en'
    text = MESSAGES[lang]
    if (auth) auth.languageCode = lang
    for (const refresh of languageViews) refresh()
  }
  document.addEventListener('langchange', () => setLang(document.documentElement.lang))
  function onChange(listener) {
    listeners.add(listener)
    listener(user)
    return () => listeners.delete(listener)
  }
  function mount(element) {
    if (!element) return () => {}
    const unique = `seeto-account-${Math.random().toString(36).slice(2)}`
    const root = document.createElement('div')
    root.className = 'seeto-account'
    // All labels below are local constants. Account/provider values use textContent.
    root.innerHTML = `<button type="button" class="account-trigger" aria-haspopup="dialog"></button>
      <dialog class="account-dialog" aria-labelledby="${unique}">
        <div class="account-dialog-top"><h2 id="${unique}">${text.title}</h2><button type="button" class="account-close" aria-label="${text.close}">×</button></div>
        <p class="account-intro">${text.intro}</p><p class="account-user" hidden></p>
        <div class="account-providers"><button type="button" data-provider="google">${text.google}</button></div>
        <button type="button" class="account-signout" hidden>${text.signOut}</button>
        <p class="account-status" role="status" aria-live="polite"></p>
        <p class="account-detail account-provider-note">${text.providerNote}</p><p class="account-detail account-readonly-note">${text.readOnly}</p><p class="account-detail account-privacy-note">${text.privacy}</p>
      </dialog>`
    element.append(root)
    const trigger = root.querySelector('.account-trigger'), dialog = root.querySelector('dialog')
    const status = root.querySelector('.account-status'), identity = root.querySelector('.account-user')
    const providers = root.querySelector('.account-providers'), logout = root.querySelector('.account-signout')
    let busy = false, disposed = false, statusKey = '', statusError = null
    function showStatus(key = '', error = null) {
      statusKey = key
      statusError = error
      status.textContent = error ? accountErrorMessage(error, lang) : text[key] || ''
      status.classList.toggle('account-error', !!error)
    }
    function render(value) {
      trigger.textContent = value ? `${text.signedIn} · ${value.displayName || text.accountName}` : text.signIn
      trigger.title = value ? value.displayName || text.accountName : text.title
      identity.hidden = !value
      identity.textContent = value ? [value.displayName || text.accountName, value.email].filter(Boolean).join(' · ') : ''
      providers.hidden = !!value
      logout.hidden = !value
    }
    function setBusy(value) {
      busy = value
      dialog.setAttribute('aria-busy', String(value))
      for (const button of dialog.querySelectorAll('[data-provider], .account-signout')) button.disabled = value
    }
    async function act(action) {
      if (busy) return
      setBusy(true)
      showStatus('working')
      try { await action(); if (!disposed) showStatus(user ? 'connected' : 'signedOut') }
      catch (error) { if (!disposed) showStatus('', error) }
      finally { if (!disposed) setBusy(false) }
    }
    trigger.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal()
      if (!sdk) {
        showStatus('preparing')
        ready().then(() => { if (!disposed && !busy) showStatus(user ? 'connected' : '') })
          .catch(error => { if (!disposed) showStatus('', error) })
      }
    })
    root.querySelector('.account-close').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close() } })
    for (const button of root.querySelectorAll('[data-provider]')) button.addEventListener('click', () => act(() => signIn(button.dataset.provider)))
    logout.addEventListener('click', () => act(signOut))
    function refreshLanguage() {
      root.querySelector('h2').textContent = text.title
      root.querySelector('.account-close').setAttribute('aria-label', text.close)
      root.querySelector('.account-intro').textContent = text.intro
      root.querySelector('[data-provider=google]').textContent = text.google
      root.querySelector('.account-provider-note').textContent = text.providerNote
      root.querySelector('.account-readonly-note').textContent = text.readOnly
      root.querySelector('.account-privacy-note').textContent = text.privacy
      logout.textContent = text.signOut
      render(user)
      showStatus(statusKey, statusError)
    }
    const unsubscribe = onChange(render)
    languageViews.add(refreshLanguage)
    // Prepare before the user's click so OAuth popup creation keeps its gesture.
    ready().catch(() => {})
    return () => { disposed = true; unsubscribe(); languageViews.delete(refreshLanguage); if (dialog.open) dialog.close(); root.remove() }
  }
  return Object.freeze({ ready, signIn, signOut, setLang, onChange, mount, verify, register, requireAccount, createPublication,
    providers: SUPPORTED_PROVIDERS, errorMessage: error => accountErrorMessage(error, lang), get sessionVersion() { return epoch }, get user() { return user } })
}
