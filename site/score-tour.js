// Each illustration runs once on selection. Automatic playback advances only while the guide is on screen.
export function mountScoreTour(tour) {
  if (!tour) return
  const scenes = [...tour.querySelectorAll('.tour-scene')]
  const navigation = tour.querySelector('.tour-steps')
  const steps = [...navigation.querySelectorAll('button')]
  const toggle = tour.querySelector('.tour-toggle')
  const labels = toggle.querySelectorAll('[data-tour-label]')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const duration = 8500
  let mode = reducedMotion.matches ? 'manual' : 'auto'
  let visible = false
  let index = 0
  let timer = null
  let started = 0
  let remaining = duration

  function stopClock() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
    remaining = Math.max(0, remaining - (performance.now() - started))
  }
  function update() {
    stopClock()
    const offscreen = !visible || document.hidden
    tour.toggleAttribute('data-idle', offscreen || mode === 'paused')
    const label = mode === 'auto' ? 'pause' : mode === 'ended' ? 'replay' : 'play'
    for (const item of labels) item.hidden = item.dataset.tourLabel !== label
    if (offscreen || mode !== 'auto') return
    started = performance.now()
    timer = setTimeout(() => {
      timer = null
      if (index + 1 < scenes.length) show(index + 1)
      else { mode = 'ended'; update() }
    }, remaining)
  }
  function show(next) {
    stopClock()
    index = next
    remaining = duration
    scenes.forEach((scene, i) => {
      scene.toggleAttribute('data-active', i === index)
      scene.inert = i !== index
      if (i === index) steps[i].setAttribute('aria-current', 'step')
      else steps[i].removeAttribute('aria-current')
    })
    update()
  }

  steps.forEach((button, i) => button.addEventListener('click', () => {
    mode = 'manual'
    show(i)
  }))
  toggle.addEventListener('click', () => {
    if (mode === 'ended') { mode = 'auto'; show(0); return }
    mode = mode === 'auto' ? 'paused' : 'auto'
    update()
  })
  reducedMotion.addEventListener('change', event => {
    if (event.matches) { mode = 'manual'; update() }
  })
  document.addEventListener('visibilitychange', update)
  tour.dataset.enhanced = ''
  navigation.hidden = false
  toggle.hidden = false
  show(0)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      update()
    }, {threshold: 0.2})
    observer.observe(tour.querySelector('.tour-scenes'))
  } else {
    visible = true
    update()
  }
}
