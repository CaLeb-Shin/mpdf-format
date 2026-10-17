from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'index.html').read_text()
s=s.replace('<html lang="en" data-auto-lang="1">','<html lang="ko">')
s=s.replace('MPDF — music belongs with your score','MPDF — 음악을 들으며, 악보를 함께')
s=s.replace('href="https://mpdf.pages.dev/" rel="canonical"','href="https://mpdf.pages.dev/ko/" rel="canonical"')
s=s.replace('rel="canonical" href="https://mpdf.pages.dev/"','rel="canonical" href="https://mpdf.pages.dev/ko/"')
s=s.replace('Make, practice and share a PDF with music. Page buttons, time markers, A–B loops and SEETO compatibility.','PDF에 음원을 연결하고, 구간 반복으로 연습하고, 하나의 MPDF로 공유하세요. SEETO 파일도 그대로 열 수 있습니다.')
(r/'ko'/'index.html').write_text(s)
print('Built Korean landing page')
