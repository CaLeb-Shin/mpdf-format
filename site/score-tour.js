// The progress line is the scene clock, so pausing it also pauses the next cut.
export function mountScoreTour(tour) {
  if (!tour || !tour.animate) return
  const scenes = [...tour.querySelectorAll('.tour-scene')]
  const navigation = tour.querySelector('.tour-steps')
  const steps = [...navigation.querySelectorAll('button')]
  const toggle = tour.querySelector('.tour-toggle')
  const labels = toggle.querySelectorAll('[data-tour-label]')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const meter = document.createElement('span')
  meter.className = 'tour-meter'
  let mode = reducedMotion.matches ? 'manual' : 'auto'
  let visible = false
  let index = 0
  let clock = null

  function update() {
    const offscreen = !visible || document.hidden
    tour.toggleAttribute('data-idle', offscreen || mode === 'paused')
    meter.hidden = mode === 'manual' || reducedMotion.matches
    for (const item of labels) item.hidden = item.dataset.tourLabel !== (mode === 'auto' ? 'pause' : 'play')
    if (offscreen || mode !== 'auto') {
      clock?.pause()
      return
    }
    if (clock) {
      clock.play()
      return
    }
    clock = meter.animate(
      [{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}],
      {duration: Number(scenes[index].dataset.duration) || 3000, fill: 'both'}
    )
    clock.onfinish = () => {
      if (mode === 'auto' && visible && !document.hidden) show((index + 1) % scenes.length)
    }
  }

  function show(next) {
    if (clock) {
      clock.onfinish = null
      clock.cancel()
      clock = null
    }
    index = next
    scenes.forEach((scene, i) => {
      scene.toggleAttribute('data-active', i === index)
      scene.inert = i !== index
      if (i === index) steps[i].setAttribute('aria-current', 'step')
      else steps[i].removeAttribute('aria-current')
    })
    const scene = scenes[index]
    scene.querySelector('.tour-art').append(meter)
    update()
  }

  steps.forEach((button, i) => button.addEventListener('click', () => {
    mode = 'manual'
    show(i)
  }))
  toggle.addEventListener('click', () => {
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
      visible = entry.intersectionRatio >= 0.35
      update()
    }, {threshold: 0.35})
    observer.observe(tour.querySelector('.tour-scenes'))
  } else {
    visible = true
    update()
  }
}
