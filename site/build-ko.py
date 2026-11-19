from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'index.html').read_text()
s=s.replace('<html lang="en" data-auto-lang="1">','<html lang="ko">')
s=s.replace('href="https://mpdf.pages.dev/" rel="canonical"','href="https://mpdf.pages.dev/ko/" rel="canonical"')
s=s.replace('rel="canonical" href="https://mpdf.pages.dev/"','rel="canonical" href="https://mpdf.pages.dev/ko/"')
s=s.replace('Paste a setlist or YouTube links to make a playable MPDF. Add your score PDF or start with song titles alone.','콘티 텍스트나 유튜브 링크를 붙여 넣으면 재생 가능한 MPDF가 완성됩니다. 악보 PDF를 추가하거나 곡명만으로 시작하세요.').replace('Turn setlist text and YouTube links into a score you can play and share.','카톡 콘티와 유튜브 링크로 듣고 공유할 수 있는 MPDF를 만드세요.').replace('https://mpdf.pages.dev/og.png','https://mpdf.pages.dev/og-ko.png')
(r/'ko'/'index.html').write_text(s)
print('Built Korean landing page')
