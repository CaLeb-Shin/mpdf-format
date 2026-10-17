# MPDF — a PDF that plays music

**MPDF (Music PDF) is a normal PDF with a playlist attached.** A regular PDF viewer displays the pages. An MPDF-aware viewer also plays the associated music: recordings, backing tracks, or YouTube references.

The base format uses standard PDF embedded files. Optional extensions add on-page playback buttons, time markers, and SEETO production data. A reader can support the base format without implementing those extensions.

```text
score.pdf  (or score.mpdf in apps that register that extension)
├─ PDF pages
└─ embedded files
   ├─ mpdf.json                 required: tracks, page cues, playback options
   ├─ backing.m4a              optional embedded audio
   ├─ seetogether-mpdf.json    optional SEETO publication metadata
   └─ seetogether-score.json   optional score/chord playback data
```

```json
{
  "mpdf": "1.0",
  "title": "Practice score",
  "tracks": [
    { "id": "backing", "title": "Backing", "src": "file:backing.m4a", "start": 10, "end": 70 }
  ],
  "cues": [ { "page": 1, "track": "backing", "at": 10 } ],
  "options": { "autoplay": false, "followPage": false, "loop": false }
}
```

Pages are one-based. `start` and `end` are times in the source recording; cue `at` uses the same absolute source-recording clock. Here, `at: 10` starts at second 10 of the original recording. Optional `timeMarkers.seconds` is relative to the track's start.

Full specification: [SPEC.md](SPEC.md). JSON Schema: [schema/mpdf.schema.json](schema/mpdf.schema.json).

## The website

Visit [mpdf.pages.dev](https://mpdf.pages.dev/) or the [Korean site](https://mpdf.pages.dev/ko/).

- [Make an MPDF](https://mpdf.pages.dev/make/): connect YouTube links or audio files, set start/end times, place playback buttons, and add time markers.
- [Open and practice](https://mpdf.pages.dev/v/): open received files, use A–B loops, and adjust embedded audio by ±12 semitones while retaining its speed. Included SEETO Copy Note data enables score, chords, original audio, or mix playback.
- [Try a complete example](https://mpdf.pages.dev/v/?file=/samples/practice.mpdf).
- Choose an original, a sharing MPDF, a score-only PDF, or a public link. Optional SEETO account integration verifies creator originals and registers new publications.

The frontend handles local files in the browser. Cloudflare Pages Functions store explicit public-link uploads in R2; public links support YouTube/HTTPS tracks only, reject embedded audio and private source material, and expire after 90 days. Creator registration uses SEETO Firebase account IDs and exact-file hashes, not a PDF upload. See [site/README.md](site/README.md) for operation and deployment.

The site does not recognize ordinary PDF notation automatically, cache YouTube for offline playback, or synchronize the SEETO app library simply through sign-in.

## Try the base format locally

```bash
python3 -m pip install pypdf
python3 python/mpdf.py make score.pdf -o score.mpdf \
    --youtube dQw4w9WgXcQ="Reference recording" --audio backing.m4a="Backing" \
    --cue 1:t1 --cue 4:t2:32.5
python3 python/mpdf.py info score.mpdf
```

Open the base reference viewer from a static server, for example `python3 -m http.server` at the repository root, then visit `/viewer/?file=../samples/mixed.mpdf`. The production web app lives separately in [site/](site/). Sample-generation utilities are in [samples/](samples/).

## Reference implementations

| Implementation | File | Scope |
|---|---|---|
| Python / pypdf | [python/mpdf.py](python/mpdf.py) | Base-format creation, reading, validation, CLI |
| JavaScript / pdf-lib | [js/mpdf.js](js/mpdf.js) | Base-format creation, reading, validation |
| Base reference viewer / pdf.js | [viewer/index.html](viewer/index.html) | Track playback and page cues |
| Production web compatibility layer | [site/mpdf-browser.js](site/mpdf-browser.js) | App extensions, attachment preservation, explicit sharing and score-only exports |

Test commands are `cd js && npm test`, `python3 python/test_mpdf.py`, and `cd site && npm test`; run them according to the task's verification scope. A test command listed here does not imply it has been run for a particular release.

A new MPDF can be produced by attaching the manifest and any audio to a plain PDF:

```python
from pypdf import PdfWriter

writer = PdfWriter(clone_from="score.pdf")
writer.add_attachment("mpdf.json", manifest_bytes)
writer.add_attachment("backing.m4a", audio_bytes)
writer.write("score-with-music.pdf")
```

This minimal example creates a new file. Revising an existing MPDF also requires preserving unknown attachments and fields, handling embedded-file name trees, and respecting creator permissions where present.

## Supporting MPDF in your app

| Level | Meaning |
|---|---|
| Level 0 — compatible | Render the ordinary PDF pages. |
| Level 1 — player | Read `mpdf.json`, validate and list tracks, play after a user gesture. Keep the official YouTube player visible. |
| Level 2 — synced | Add page cues, position handling, and `.mpdf` extension registration as described in the spec. |
| Optional extensions | Interpret playback buttons, time markers, or SEETO score data when supported. |

Place the player outside the score area or in a collapsible panel. Optional buttons and markers use an interaction layer without rewriting the underlying pages. Unknown fields should not break base playback, and should be retained when revising an original.

## Preserve originals and separate sharing copies

An unchanged download returns the original bytes. Rewriting a PDF changes its SHA-256 and can invalidate its creator registration, even if its visible pages look identical. Keep Unicode filenames and unknown attachments in a creator-original workflow.

Sharing is a separate export: remove editable source PDFs and private markup, preserve the finished score and intended playback data, and mark the output read-only. Public-link hosting can apply additional restrictions. A score-only PDF intentionally removes MPDF and music attachments.

SEETO publication metadata is an optional extension. Embedded `creatorUID` is only a claim: revision permission requires the signed-in non-anonymous UID, exact PDF SHA-256, and publication ID to match the immutable server registry. Shared read-only copies remain read-only even for their creator. Account verification is not required by the base MPDF format.

## File names and portability

Use **`.pdf`** for ordinary PDF app compatibility. Use `.mpdf` when the receiving app registers that extension. Both contain valid PDFs; music inclusion is determined by the contents, not the extension.

Send the actual file. Printing to PDF, screenshots, and some compressors or editors discard embedded files, including music and creator metadata. YouTube and external URLs need internet access. Embedded audio can play offline in an already-loaded capable viewer; the website itself needs a connection to load initially.

## License

Code: MIT. Specification text: CC BY 4.0. The name and logo are reserved for conforming implementations.

## 한국어 요약

MPDF는 PDF 안에 `mpdf.json` 재생 목록과 선택적으로 음원 파일을 담는 형식입니다. 일반 PDF 앱에서는 악보를 보고, 지원 뷰어에서는 음악을 함께 듣습니다. 페이지 버튼·시간 마킹과 SEETO 카피 노트 자료는 선택 확장입니다.

- [웹 제작기](https://mpdf.pages.dev/make/?lang=ko)에서 PDF에 음악·버튼·시간 표시를 넣습니다.
- [연습 뷰어](https://mpdf.pages.dev/v/?lang=ko)에서 A–B 반복, 내장 음원 키 조절, 포함 데이터에 따른 악보·코드·원음 선택을 사용합니다.
- 원본 저장·공유용 MPDF·악보만 PDF를 구분합니다. 원본은 바이트와 제작 정보를 보존하며, 공유본은 편집용 원본을 제외합니다.
- 공개 링크는 YouTube·HTTPS 트랙만 지원하고 90일 동안 이용할 수 있습니다. 내장 음원과 편집용 원본은 공개 링크로 올리지 않습니다.
- 선택적 SEETO 계정 연동은 제작자 원본의 정확한 파일 해시와 소유자를 확인합니다. 공유본은 제작자에게도 읽기 전용입니다.
- 코드 MIT, 사양 CC BY 4.0. 자세한 내용은 [웹사이트 운영 안내](site/README.md)와 [사양](SPEC.md)을 참고하세요.
