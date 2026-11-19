const article = document.querySelector('main.doc')
const headings = article.querySelectorAll('h2')
if (headings.length >= 2) {
  const titles = {en:'On this page', ko:'이 페이지의 내용', ja:'このページの目次'}
  const title = titles[document.documentElement.lang] || titles.en
  const contents = document.createElement('details')
  contents.className = 'contents'
  contents.open = matchMedia('(min-width: 761px)').matches
  const summary = document.createElement('summary')
  summary.textContent = title
  const links = document.createElement('nav')
  links.setAttribute('aria-label', title)
  for (const [index, heading] of Array.from(headings).entries()) {
    if (!heading.id) heading.id = 'section-' + (index + 1)
    const link = document.createElement('a')
    link.href = '#' + heading.id
    link.textContent = heading.textContent
    links.append(link)
  }
  contents.append(summary, links)
  const layout = document.createElement('div')
  layout.className = 'reading-layout'
  article.before(layout)
  layout.append(contents, article)
}
