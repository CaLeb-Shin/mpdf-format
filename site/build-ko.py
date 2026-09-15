#!/usr/bin/env python3
"""ko/index.html is index.html with lang=ko and Korean metadata; the page carries both languages' text."""
import re, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
s = open("index.html", encoding="utf-8").read()
s = s.replace('<html lang="en">', '<html lang="ko">')
s = s.replace("<title>MPDF — sheet music that plays</title>", "<title>MPDF — 음악이 같이 재생되는 PDF</title>")
s = s.replace('<meta name="description" content="Attach YouTube links or audio to a PDF and it becomes an MPDF: it opens in every PDF viewer, and in an MPDF viewer the music plays while you read.">',
              '<meta name="description" content="PDF에 유튜브 링크나 음원을 붙여 MPDF로 만드세요. 어떤 PDF 뷰어에서도 그냥 열리고, MPDF 뷰어에서는 악보를 보는 동안 음악이 나옵니다.">')
s = s.replace('<link rel="canonical" href="https://mpdf.pages.dev/">', '<link rel="canonical" href="https://mpdf.pages.dev/ko/">')
s = s.replace('<meta property="og:title" content="MPDF — sheet music that plays">', '<meta property="og:title" content="MPDF — 음악이 같이 재생되는 PDF">')
s = s.replace('<meta property="og:description" content="A PDF with a playlist attached. Opens everywhere; plays music in an MPDF viewer.">', '<meta property="og:description" content="PDF에 유튜브 링크를 붙여 보내면, 받는 사람 모두 악보를 보면서 듣습니다.">')
s = s.replace('content="https://mpdf.pages.dev/og.png"', 'content="https://mpdf.pages.dev/og-ko.png"').replace('<meta property="og:url" content="https://mpdf.pages.dev/">', '<meta property="og:url" content="https://mpdf.pages.dev/ko/">')
# relative paths go up one level; the Korean footer links are already ko/-relative on the root page, so rewrite those to same-folder
s = s.replace('href="site.css"', 'href="../site.css"').replace('href="favicon.svg"', 'href="../favicon.svg"').replace('src="maker.js"', 'src="../maker.js"')
s = s.replace('href="v/"', 'href="../v/"').replace('href="?file=samples/score.pdf"', 'href="?file=../samples/score.pdf"').replace('<a class="brand" href="./">', '<a class="brand" href="../">')
s = s.replace('href="ko/guide"', 'href="guide"').replace('href="ko/report"', 'href="report"').replace('href="ko/terms"', 'href="terms"')
s = re.sub(r'href="guide"(?![^<]*data-l)', 'href="../guide"', s, count=1)   # nav Guide link (English target)
s = s.replace('<nav data-l="en"><a href="guide">', '<nav data-l="en"><a href="../guide">').replace('<a href="report">Report</a><a href="terms">Terms</a>', '<a href="../report">Report</a><a href="../terms">Terms</a>')
open("ko/index.html", "w", encoding="utf-8").write(s)
print("ko/index.html built")
