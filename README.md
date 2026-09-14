# MPDF — a PDF that plays music

**MPDF ("Music PDF") is a normal PDF with a playlist attached.** Open it in any PDF viewer and it is
just the PDF. Open it in an MPDF-aware viewer and the music plays while you read, switching tracks
as you turn pages. Sheet music with the recording, a setlist with YouTube links, a lesson book with
the teacher's backing track.

- **Never breaks the PDF.** Page content is untouched. "Unsupported" simply means "a normal PDF".
- **Trivial to make.** One JSON file attached to the PDF. Five lines with any PDF library.
- **Trivial to support.** Read one attachment, parse JSON, play. No new container or parser.
- **Open.** Spec CC BY 4.0, reference code MIT, no patents, no royalties.

```
setlist.mpdf   (= a valid PDF; rename to .pdf and it still opens everywhere)
├─ pages 1..N            ← the original PDF, unchanged
└─ embedded files        ← standard PDF attachments (ISO 32000-1 §7.11.4)
   ├─ mpdf.json          ← required: tracks + page cues
   └─ track2.m4a         ← optional: embedded audio
```

```json
{
  "mpdf": "1.0",
  "title": "Piano Book 2",
  "tracks": [
    { "id": "t1", "title": "Canon in D", "src": "youtube:dQw4w9WgXcQ" },
    { "id": "t2", "title": "Arirang",     "src": "file:track2.m4a" }
  ],
  "cues": [ { "page": 1, "track": "t1" }, { "page": 4, "track": "t2", "at": 32.5 } ]
}
```

Full specification: [SPEC.md](SPEC.md). JSON Schema: [schema/mpdf.schema.json](schema/mpdf.schema.json).

## Try it in 30 seconds

```bash
python3 -m pip install pypdf
python3 python/mpdf.py make score.pdf -o score.mpdf \
    --youtube dQw4w9WgXcQ="Canon in D" --audio backing.m4a="Backing" \
    --cue 1:t1 --cue 4:t2:32.5
python3 python/mpdf.py info score.mpdf
```

Then open `viewer/index.html` from any static server (for example `python3 -m http.server` in this
folder and visit `/viewer/?file=../samples/mixed.mpdf`), or drop the file onto the page.
Sample files are in [samples/](samples/) (regenerate with `python3 samples/make_samples.py`).

## The website

Live at **https://mpdf.pages.dev**. [site/](site/) is the maker + viewer web app (static files, no server): drop a PDF, paste YouTube links or add audio,
assign tracks to pages, save as `.pdf`. Its viewer shows the PDF exactly like a plain viewer with a collapsible
floating player. See [site/README.md](site/README.md).

## Reference implementations

| language | file | API |
|---|---|---|
| Python 3.8+ (pypdf) | [python/mpdf.py](python/mpdf.py) | `create(pdf_bytes, manifest, files)`, `read(pdf_bytes)`, `validate(manifest)`, plus the CLI |
| JavaScript / browser (pdf-lib) | [js/mpdf.js](js/mpdf.js) | `createMpdf(pdfBytes, manifest, files)`, `readMpdf(pdfBytes)`, `validate(manifest)` |
| Web viewer (pdf.js) | [viewer/index.html](viewer/index.html) | Level 1 player + page cues, in one HTML file |

Each library is about 80 lines. Tests: `cd js && npm install && npm test`, `python3 python/test_mpdf.py`.
The tests also read each other's output, so a file made in Python opens in JS and vice versa.

Any other PDF library works the same way. The producer side is literally "attach a file":

```python
w = PdfWriter(clone_from="score.pdf")
w.add_attachment("mpdf.json", manifest_bytes)
w.add_attachment("track2.m4a", audio_bytes)
w.write("score.mpdf")
```

```js
const doc = await PDFDocument.load(pdfBytes)          // pdf-lib, in the browser
await doc.attach(manifestBytes, "mpdf.json", { mimeType: "application/json" })
```

```swift
// PDFKit (iOS/macOS): read the manifest
let attachments = pdfDocument.documentAttributes ... // see SPEC §1: EmbeddedFiles name tree
```

## Supporting MPDF in your app

| level | what it means |
|---|---|
| **Level 0** Compatible | You open PDFs. You already support MPDF. |
| **Level 1** Player | Read `mpdf.json`, list tracks, play them. YouTube through the official player, kept visible. |
| **Level 2** Synced | Level 1 + page cues, remember last position, register the `.mpdf` extension. |

Rules that keep the format trustworthy (details in [SPEC.md §3](SPEC.md)): never draw over page
content; player UI docked outside the page or a movable, collapsible floating panel; no autoplay before a user gesture; ignore unknown fields.

## Naming the file

Save and share it as **`.pdf`**. Every viewer opens it today, and an MPDF-aware app recognizes the
file by its `mpdf.json` attachment, not by its name. Use `.mpdf` only as an opt-in for apps that register
the extension. Note that anything that re-renders pages (print to PDF, screenshots, some compressors)
drops the attachment; sending the file itself keeps it intact.

## Why this design

- **PDF attachments, not a ZIP.** A ZIP would not open in the PDF viewers people already have.
  Attachments have been standard PDF since 2001 and every major library reads them. This is the same
  path Factur-X / ZUGFeRD took (an XML invoice embedded in a PDF), which is now an industry standard.
- **JSON, not PDF annotations.** Cues live in the manifest only, so nothing appears on the page.
- **YouTube links first.** Zero file size, no copyright hosting, and the easiest thing to paste.

## License

Code: MIT. Specification text: CC BY 4.0. The name and logo are reserved for conforming implementations.

---

## 한국어 요약

**MPDF는 "음악이 붙은 PDF"입니다.** 일반 PDF 안에 표준 첨부파일 기능으로 `mpdf.json`(트랙 목록 + 페이지별 큐)과
선택적으로 음원 파일을 넣습니다. MPDF를 모르는 뷰어에서는 그냥 PDF로 열리고, 지원하는 뷰어에서는 악보를 보는 동안
유튜브·내장 음원이 재생되며 페이지를 넘기면 곡이 바뀝니다.

- 만들기: `python3 python/mpdf.py make 악보.pdf -o 악보.mpdf --youtube 영상ID="곡제목" --cue 1:t1`
- 확인: `python3 python/mpdf.py info 악보.mpdf`
- 보기: `viewer/index.html`을 정적 서버로 열고 파일을 드롭
- 스펙: [SPEC.md](SPEC.md) · 스키마: [schema/mpdf.schema.json](schema/mpdf.schema.json)
- 파일 이름: 기본은 `.pdf`로 저장·공유(어디서나 열림). `.mpdf`는 지원 앱용 선택지. "PDF로 인쇄"·스크린샷·재저장은 첨부를 지워 음악 정보가 사라집니다.
- 라이선스: 코드 MIT, 스펙 CC BY 4.0. 특허 없음, 로열티 없음.
