from pathlib import Path
r=Path(__file__).resolve().parent
s=(r/'index.html').read_text()
s=s.replace('<html lang="en" data-auto-lang="1">','<html lang="ja">')
s=s.replace('MPDF — music belongs with your score','MPDF — 楽譜と音楽を、いっしょに')
s=s.replace('rel="canonical" href="https://mpdf.pages.dev/"','rel="canonical" href="https://mpdf.pages.dev/ja/"')
s=s.replace('Make, practice and share a PDF with music. Page buttons, time markers, A–B loops and SEETO compatibility.','PDFに音源をつなげ、A–Bループで練習し、1つのMPDFで共有。SEETOのファイルもそのまま開けます。')
s=s.replace('Create. Practice. Share. Your score and music in one PDF.','作って、練習して、共有する。楽譜と音楽を1つのPDFに。')
(r/'ja').mkdir(exist_ok=True)
(r/'ja'/'index.html').write_text(s)
print('Built Japanese landing page')
