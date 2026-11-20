export function highlightSetlistStep(form, hasScoreChoice, text) {
  let current = '1'
  if (hasScoreChoice) current = text.trim() ? '3' : '2'
  for (const step of form.querySelectorAll('[data-step]')) {
    if (step.dataset.step === current) step.setAttribute('aria-current', 'step')
    else step.removeAttribute('aria-current')
  }
}
