from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'index.html').read_text()
s=s.replace('<html lang="en" data-auto-lang="1">','<html lang="ja">')
s=s.replace('rel="canonical" href="https://mpdf.pages.dev/"','rel="canonical" href="https://mpdf.pages.dev/ja/"')
s=s.replace('Connect a score PDF to YouTube references and share a playable setlist with SEETogether.','楽譜PDFにYouTubeの参考動画をつなげ、SEETogetherで再生できるセットリストを共有しましょう。').replace('Make a playable score and share it with your ensemble.','楽譜と参考動画をメンバーに共有しましょう。').replace('https://mpdf.pages.dev/og.png','https://mpdf.pages.dev/og-ja.png')
(r/'ja').mkdir(exist_ok=True)
(r/'ja'/'index.html').write_text(s)
print('Built Japanese landing page')
