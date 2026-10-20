#!/usr/bin/env python3
"""Builds ja/ static pages from the English ones using ja-pages.json (English text segment -> Japanese).
Re-run after editing an English page; add any new segments to ja-pages.json (missing ones are reported)."""
import json, re, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
T = json.load(open("ja-pages.json", encoding="utf-8"))
PAGES = ["guide", "terms", "report", "developers", "guides/lesson-book", "guides/choir-parts", "guides/youtube-links"]
SITE = "https://mpdf.pages.dev"
missing = set()
# Japanese sentences that continue after a link or code span
FIX = [("開発者ガイド</a>.", "開発者ガイド</a>をお読みください。"), ("報告・削除</a>.", "報告・削除</a>をご利用ください。"),
       ("SEETOサポート</a>.", "SEETOサポート</a>をご覧ください。"), ("GitHub Issues</a>.", "GitHub Issues</a>からも送れます。"),
       ("作成ツール</a>.", "作成ツール</a>にドロップします。"), ("</code>).", "</code>)。"), ("</code>, <code>", "</code>、<code>"),
       ("</code>.", "</code>。"), ("</a>.", "</a>。"), ('<a class="keep" href="/ja/' , '<a class="keep" data-self href="/ja/'), ("'Copied'", "'コピーしました'"), ("'Copy'", "'コピー'")]

def tr_text(s):
    k = s.strip()
    if not k or not re.search("[A-Za-z]", k): return s
    if k in T:
        lead = s[:len(s) - len(s.lstrip())]; trail = s[len(s.rstrip()):]
        if re.search("[ぁ-んァ-ン一-龯]", T[k]): lead, trail = lead.replace(" ", ""), trail.replace(" ", "")  # no spaces around Japanese
        return lead + T[k] + trail
    missing.add(k); return s

def translate(html):
    out, i, skip = [], 0, 0
    for m in re.finditer(r"<[^>]+>", html):
        out.append(tr_text(html[i:m.start()]) if not skip else html[i:m.start()])
        tag = m.group(0); name = re.match(r"</?\s*([a-zA-Z0-9]+)", tag)
        name = name.group(1).lower() if name else ""
        if name in ("script", "style", "pre", "code"):
            skip += -1 if tag.startswith("</") else (0 if tag.endswith("/>") else 1)
        if not tag.startswith("</"):
            tag = re.sub(r'\b(content|title|aria-label|placeholder)="([^"]*)"',
                         lambda a: f'{a.group(1)}="{T.get(a.group(2).strip(), a.group(2))}"' if not a.group(2).startswith("http") else a.group(0), tag)
        out.append(tag); i = m.end()
    out.append(html[i:]); return "".join(out)

for page in PAGES:
    s = open(f"{page}.html", encoding="utf-8").read()
    s = translate(s)
    s = s.replace('<html lang="en"', '<html lang="ja"', 1)
    # alternates: add ja, canonical -> ja
    s = s.replace(f'<link rel="alternate" hreflang="ko" href="{SITE}/ko/{page}">', f'<link rel="alternate" hreflang="ko" href="{SITE}/ko/{page}">\n  <link rel="alternate" hreflang="ja" href="{SITE}/ja/{page}">')
    s = s.replace(f'<link rel="canonical" href="{SITE}/{page}">', f'<link rel="canonical" href="{SITE}/ja/{page}">')
    s = s.replace(f'content="{SITE}/og.png"', f'content="{SITE}/og-ja.png"')
    # internal links -> Japanese pages / app in Japanese
    s = s.replace('?lang=en', '?lang=ja').replace('&amp;lang=en', '&amp;lang=ja')
    s = re.sub(r'href="/(guide|terms|report|developers|guides/[a-z-]+)(\.html)?"', r'href="/ja/\1"', s)
    s = s.replace('<a class="brand" href="/">', '<a class="brand" href="/ja/">')
    # language links: English + Korean instead of the Korean-only link
    s = re.sub(r'<a class="keep" href="/ja/([^"]*)" hreflang="ko"( lang="ko")?>한국어</a>|<a class="keep" href="/ko/([^"]*)" hreflang="ko"( lang="ko")?>한국어</a>',
               lambda m: f'<a class="keep" href="/{m.group(1) or m.group(3)}" hreflang="en" lang="en">English</a><a class="keep" href="/ko/{m.group(1) or m.group(3)}" hreflang="ko" lang="ko">한국어</a>', s)
    for a, b in FIX:
        s = s.replace(a, b)
    s = re.sub(r'<a class="keep" data-self href="/ja/[^"]*"[^>]*>日本語</a>', '', s)
    os.makedirs(os.path.dirname(f"ja/{page}.html") or "ja", exist_ok=True)
    open(f"ja/{page}.html", "w", encoding="utf-8").write(s)

# English and Korean pages: add the Japanese alternate + a 日本語 link (idempotent)
for page in PAGES:
    for path in (f"{page}.html", f"ko/{page}.html"):
        s = open(path, encoding="utf-8").read(); o = s
        alt = f'<link rel="alternate" hreflang="ja" href="{SITE}/ja/{page}">'
        if alt not in s: s = s.replace(f'<link rel="alternate" hreflang="ko" href="{SITE}/ko/{page}">', f'<link rel="alternate" hreflang="ko" href="{SITE}/ko/{page}">\n  {alt}')
        if 'hreflang="ja" lang="ja">日本語</a>' not in s:
            s = re.sub(r'(<a class="keep" href="[^"]*" hreflang="(?:ko|en)"(?: lang="(?:ko|en)")?>(?:한국어|English)</a>)', r'\1' + f'<a class="keep" href="/ja/{page}" hreflang="ja" lang="ja">日本語</a>', s, count=1)
        if s != o: open(path, "w", encoding="utf-8").write(s)

if missing: print("MISSING:", *sorted(missing), sep="\n  "); sys.exit(1)
print("Built", len(PAGES), "Japanese pages")
