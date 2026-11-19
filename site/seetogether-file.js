// SEETogether declares dev.mpdf.document and com.adobe.pdf as importable scores.
export function scoreFile(bytes, stem, extension = 'mpdf') {
  return new File([bytes], stem + '.' + extension, {type:'application/pdf'})
}

export function shareableScore(bytes, stem) {
  for (const extension of ['mpdf','pdf']) {
    const file = scoreFile(bytes, stem, extension)
    if (navigator.canShare?.({files:[file]})) return file
  }
  return null
}
