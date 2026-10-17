# MPDF Specification — version 1.0 with optional page controls (2026-10-18)

**MPDF ("Music PDF") is a PDF file that carries a playlist.** An MPDF-aware viewer plays audio
(YouTube, embedded audio files, or URLs) while the reader looks at the pages, and can switch
tracks as pages turn. Every MPDF file is a valid PDF: any PDF viewer opens it unchanged.

Design goals, in priority order:

1. **Never break the PDF.** Page content is untouched. Unaware viewers see a normal PDF.
2. **Trivial to produce.** One JSON file attached to the PDF. Five lines of code in any language with a PDF library.
3. **Trivial to consume.** Read one attachment, parse JSON, play. No new container, no new parser.

The spec text is licensed CC BY 4.0. Reference implementations are MIT.

---

## 1. Container

- An MPDF file **is a PDF** (ISO 32000-1, PDF 1.4 or later). Nothing else.
- It MUST contain an embedded file in the document-level `EmbeddedFiles` name tree
  (ISO 32000-1 §7.11.4) whose key is exactly `mpdf.json`.
- Audio and image files MAY be embedded the same way. The manifest references them by key.
- Base producers add attachments without changing pages. An author explicitly placing page controls MAY add a printable control and an HTTPS help link (§2.6). Such controls must not obscure notation. Time markers remain interactive metadata, not printed page content.
- File extension: distribute as **`.pdf`** (opens everywhere today; MPDF-aware apps detect the file by its attachment, not its name). `.mpdf` is an optional alias for apps that register it. Media type: `application/pdf`.
- Anything that re-renders pages (print to PDF, screenshots, some compressors and markup tools) drops attachments and with them the playlist; the file is then a plain PDF. Sending the file itself (chat, mail, cloud drive) keeps it intact.
- **Detection rule:** a PDF is an MPDF *iff* an embedded file keyed `mpdf.json` exists and parses
  as a manifest whose `mpdf` field is a string starting with `"1."`.

Why attachments and not a ZIP: a ZIP would not open in existing PDF viewers. An attachment is
standard PDF since 2001, supported by pdf.js, PDFKit, Acrobat, pypdf, pdf-lib, iText, PDFBox.
This is the same pattern as Factur-X / ZUGFeRD (an XML invoice embedded in a PDF), which became
an industry standard precisely because "unsupported" still means "a normal PDF".

## 2. Manifest — `mpdf.json`

UTF-8 JSON, no BOM. Unknown fields MUST be ignored for playback by consumers and MUST be preserved by editors on a lossless save (forward compatibility). Reading or re-saving a file MUST NOT regenerate existing track or control IDs.

```json
{
  "mpdf": "1.0",
  "title": "Piano Book 2",
  "tracks": [
    { "id": "t1", "title": "Canon in D", "src": "youtube:dQw4w9WgXcQ" },
    { "id": "t2", "title": "Arirang",     "src": "file:track2.m4a" },
    { "id": "t3", "src": "https://cdn.example.com/song.mp3" }
  ],
  "cues": [
    { "page": 1, "track": "t1" },
    { "page": 4, "track": "t2", "at": 32.5 }
  ],
  "options": { "autoplay": false, "followPage": true }
}
```

### 2.1 Top level

| field     | type     | required | description |
|-----------|----------|----------|-------------|
| `mpdf`    | string   | yes      | Spec version. `"1.0"`. Consumers accept any `"1.x"`. |
| `title`   | string   | no       | Display title for the whole file. |
| `tracks`  | Track[]  | yes      | At least one track. |
| `cues`    | Cue[]    | no       | Page → track mapping. |
| `options` | object   | no       | Playback hints (§2.5). |

### 2.2 Track

| field    | type   | required | description |
|----------|--------|----------|-------------|
| `id`     | string | yes      | Unique within the file. `[A-Za-z0-9_-]{1,64}`. |
| `src`    | string | yes      | Source URI (§2.4). |
| `title`  | string | no       | Display name. |
| `artist` | string | no       | Display name. |
| `start`  | number | no       | Seconds. Position used when the track is selected without a cue. Default `0`. |
| `end`    | number | no       | Seconds. Exclusive stop point, strictly greater than `start`. Default: end of media. |

### 2.3 Cue

| field   | type    | required | description |
|---------|---------|----------|-------------|
| `page`  | integer | yes      | 1-based page index. |
| `track` | string  | yes      | A track `id`. |
| `at`    | number  | no       | Absolute source seconds. Default: track `start`, otherwise `0`. |

**Semantics.** When page *P* becomes the current page and a cue with `page == P` exists, the
viewer selects that cue's track and seeks to `at`, clamped to the track's playable start/end range. `at` uses the absolute source clock; an omitted `at` uses the track's `start`. If playback was active, it stays active. If no
cue exists for *P*, playback is unchanged. At most one cue per page; on duplicates the first wins.
What "current page" means is up to the viewer (the page under the reader's focus).

### 2.4 Sources (`src`)

| scheme     | example                              | meaning |
|------------|--------------------------------------|---------|
| `youtube:` | `youtube:dQw4w9WgXcQ`                | YouTube video id. Viewers MUST use an official YouTube player (IFrame, Android or iOS SDK) and MUST keep it visible, per YouTube's terms. Audio extraction or hidden playback is not allowed. |
| `file:`    | `file:track2.m4a`                    | Embedded file with this key in the same PDF. |
| `https:`   | `https://example.com/song.mp3`       | Direct audio URL over HTTPS. |

Consumers MUST ignore tracks whose scheme they do not understand, without failing.
Recommended embedded audio: AAC in `.m4a` at 128 kbps (about 1 MB per minute), or MP3.

### 2.5 Options

| field        | type    | default | description |
|--------------|---------|---------|-------------|
| `autoplay`   | boolean | `false` | Hint only. Viewers MUST NOT start audio before a user gesture where the platform requires one. |
| `followPage` | boolean | `true`  | Apply cues on page change. |
| `loop`       | boolean | `false` | Restart the track when it ends. |

### 2.6 Optional page controls and native metadata

`buttons` contains `{ id, page, track, x, y }`. `id` is a stable UUID, `page` is
1-based, and `track` names an existing track. Coordinates are relative to the
visible rotated crop box, with top-left origin; `x` and `y` lie in `[0.05, 0.95]`.
Native SEETO producers print the button on the PDF. A compatible reader uses a
transparent hit target over it instead of drawing the same button twice.

`timeMarkers` contains `{ id, page, track, choice?, seconds, x, y }`. IDs are stable
UUIDs. Unlike cue `at`, marker `seconds` is **relative to the track's start**
(the clock shown to the reader). It must be nonnegative and at most
`track.end - (track.start ?? 0)` when an end is present. The optional playback
choice is an ASCII identifier of at most 80 characters. Coordinates lie in
`[0, 1]`. Time markers are interactive bookmarks, never burned into PDF pages.

Example (a marker at source time 42s for a track that begins at 30s):

```json
{
  "mpdf": "1.0",
  "tracks": [{ "id": "source", "src": "file:audio-1234.mp3", "start": 30, "end": 90 }],
  "buttons": [{ "id": "d4dc868d-b62e-4ec5-a673-6029aa63f71e", "page": 1, "track": "source", "x": 0.88, "y": 0.12 }],
  "timeMarkers": [{ "id": "5c6816ef-a686-40fb-af25-53988504697e", "page": 1, "track": "source", "seconds": 12, "x": 0.5, "y": 0.4 }]
}
```

Native publication metadata is carried in `seetogether-mpdf.json`. Its track-role
fields (`scoreTrackID`, `chordTrackID`, `sourceTrackID`), sync map and page ordering
may help playback. `seetogether-score.json` carries finalized notation for future
imports and synchronized playback. Unknown fields in both attachments survive an
ordinary edit. JSON is data and does not prove ownership.

`creatorUID` is a display claim. Native revision access requires authentication
plus the server registry's immutable owner and publication ID for the exact PDF
SHA-256. `sharedReadOnly: true` always denies creator editing, even to its original
author. Creating a revision changes the PDF's hash and requires a new registration.

The optional `web` object can contain `sourcePDFKey`, `buttonRendering` (`baked` or
`overlay`), and `sharedReadOnly`. `baked` means a printable button is already on
the page. The web source attachment is `mpdf-web-source.pdf`; it is private authoring
data. These hints are not authorization credentials.

### 2.7 Original, shared MPDF, and plain PDF

- **Original download:** return the input bytes unchanged; this preserves hash-based
  creator registration, all attachments, and unsupported metadata.
- **Author revision:** retain unknown fields and unrelated attachments. Update known
  fields using stable IDs. Never silently grant native ownership from metadata alone.
- **Shared MPDF:** preserve display pages and playback tracks/markers; remove clean
  source PDFs and editable drawing attachments, including publication-referenced
  `sourcePDFKey` and `editableMarkupKey`, `seetogether-original.pdf`,
  `seetogether-editing.pdf`, `seetogether-markup.json`, and `mpdf-web-source.pdf`.
  Clear those references and mark the copy read-only. Finalized `seetogether-score.json`
  is retained, matching the native sharing format. A native shared publication gets
  a fresh ID and creation timestamp; its creator claim remains informational.
- **Plain PDF:** copy display pages without embedded attachments or MPDF metadata.
  A clean source can remove printed controls when available and appropriate. If
  only the final pages exist, already printed graphics remain part of the page.

When removing private data, unlinking an attachment tree is insufficient: orphaned
streams can remain in a saved PDF object table. Shared/plain export builds a new
page document and omits file/media annotations and associated-file references,
so private streams are physically absent from the resulting file.

The reference public-link service accepts at most 20 MiB, YouTube/HTTPS tracks,
and the known sharing-safe publication/score metadata. It rejects embedded audio,
private authoring sources, malformed metadata and unknown attachments. Links stop
serving files 90 days after upload, using R2's upload timestamp (legacy creation
metadata is a fallback); responses have a cache lifetime of at most 60 seconds.
Expiry denies access and does not promise physical storage deletion. Local files
have no link expiry.

## 3. Viewer conformance

| level | name       | requirement |
|-------|------------|-------------|
| 0     | Compatible | Opens the file as a PDF. Every PDF viewer already qualifies. |
| 1     | Player     | Reads the manifest, lists tracks, plays `file:` and `https:` tracks; `youtube:` via an official player. |
| 2     | Synced     | Level 1 plus: applies cues on page change, remembers last position per file, and registers the `.mpdf` extension so the OS offers the app for such files. |

**UI rules for Level 1 and above (MUST):**

- Do not cover notation with automatic overlays, watermarks or badges. Explicit author-placed page controls and time markers are allowed (§2.6); playback itself must not jump or scroll the page without the reader opting in.
- Player controls never sit fixed over page content: either docked outside the page area (a bar of at most 56 pt), or a floating panel the reader can move and collapse to a small pill.
- One tap stops the audio.
- No autoplay before a user gesture.
- Track switches on cue: crossfade within 300 ms, no visual flash, no page jump.
- Unknown manifest fields and unknown `src` schemes are ignored silently.

A viewer may state its level as `MPDF Level 1` or `MPDF Level 2`.

## 4. Producer rules

- Preserve page content unless the author explicitly places printable controls (§2.6). Do not re-render an existing MPDF simply to update its metadata. Never draw a second visible control over a control already printed in the PDF.
- Attachment MIME types: `application/json` for the manifest; `audio/mp4`, `audio/mpeg`,
  `audio/wav` for audio. (Informative. Consumers key on the file name, not the MIME type.)
- Refuse to produce a file whose manifest fails validation (`schema/mpdf.schema.json`).
- Refuse to add a second `mpdf.json` to a file that already has one; replace it instead. Preserve unrelated attachments and unknown manifest fields on an ordinary save.
- New embedded file keys SHOULD match `[A-Za-z0-9][A-Za-z0-9._-]{0,127}` without `..`; UUID-based keys keep Korean/Unicode display names compatible with native readers. Keep the original display name in the track title. Existing Unicode keys may be retained for lossless reads, or explicitly migrated together with every known reference when making a revision.
- All times and coordinates MUST be finite. Producers validate track end > start, unique IDs, track references, and page bounds in addition to the JSON schema. Current native interoperability limits are 256 tracks, 256 buttons, 2,048 time markers, and a 1 MiB manifest.

## 5. Security

- The manifest is data. Consumers MUST NOT execute anything found in it.
- `https:` sources SHOULD be fetched over HTTPS only. Consumers MAY refuse other origins.
- Consumers MAY refuse embedded files above a size limit of their choosing.

## 6. Versioning

- Minor versions (`1.x`) only add optional fields. A `1.0` consumer plays a `1.3` file.
- A major version change (`2.0`) is a new attachment key (`mpdf2.json`) so `1.x` consumers keep working.
