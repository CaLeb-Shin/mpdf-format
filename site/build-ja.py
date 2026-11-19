from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'index.html').read_text()
s=s.replace('<html lang="en" data-auto-lang="1">','<html lang="ja">')
s=s.replace('rel="canonical" href="https://mpdf.pages.dev/"','rel="canonical" href="https://mpdf.pages.dev/ja/"')
s=s.replace('Paste a setlist or YouTube links to make a playable MPDF. Add your score PDF or start with song titles alone.','曲順やYouTubeリンクを貼り付けて、再生できるMPDFを作成。楽譜PDFの添付や曲名だけの入力にも対応します。').replace('Turn setlist text and YouTube links into a score you can play and share.','曲順やYouTubeリンクから、再生して共有できるMPDFを作れます。').replace('https://mpdf.pages.dev/og.png','https://mpdf.pages.dev/og-ja.png')
(r/'ja').mkdir(exist_ok=True)
(r/'ja'/'index.html').write_text(s)
print('Built Japanese landing page')
