from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'index.html').read_text()
s=s.replace('<html lang="en" data-auto-lang="1">','<html lang="ko">')
s=s.replace('href="https://mpdf.pages.dev/" rel="canonical"','href="https://mpdf.pages.dev/ko/" rel="canonical"')
s=s.replace('rel="canonical" href="https://mpdf.pages.dev/"','rel="canonical" href="https://mpdf.pages.dev/ko/"')
s=s.replace('Connect a score PDF to YouTube references and share a playable setlist with SEETogether.','악보 PDF와 유튜브 레퍼런스를 연결하고 SEETogether에서 재생할 콘티를 카톡으로 공유하세요.').replace('Make a playable score and share it with your ensemble.','콘티 악보와 레퍼런스를 팀원들에게 보내세요.').replace('https://mpdf.pages.dev/og.png','https://mpdf.pages.dev/og-ko.png')
(r/'ko'/'index.html').write_text(s)
print('Built Korean landing page')
