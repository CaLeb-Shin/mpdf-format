# MPDF Specification — version 1.0 (draft, 2026-09-12)

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
- Producers MUST NOT alter page content streams. Producers SHOULD NOT add annotations.
- File extension: distribute as **`.pdf`** (opens everywhere today; MPDF-aware apps detect the file by its attachment, not its name). `.mpdf` is an optional alias for apps that register it. Media type: `application/pdf`.
- Anything that re-renders pages (print to PDF, screenshots, some compressors and markup tools) drops attachments and with them the playlist; the file is then a plain PDF. Sending the file itself (chat, mail, cloud drive) keeps it intact.
- **Detection rule:** a PDF is an MPDF *iff* an embedded file keyed `mpdf.json` exists and parses
  as a manifest whose `mpdf` field is a string starting with `"1."`.

Why attachments and not a ZIP: a ZIP would not open in existing PDF viewers. An attachment is
standard PDF since 2001, supported by pdf.js, PDFKit, Acrobat, pypdf, pdf-lib, iText, PDFBox.
This is the same pattern as Factur-X / ZUGFeRD (an XML invoice embedded in a PDF), which became
an industry standard precisely because "unsupported" still means "a normal PDF".

## 2. Manifest — `mpdf.json`

UTF-8 JSON, no BOM. Unknown fields MUST be ignored by consumers (forward compatibility).

```json
{
  "mpdf": "1.0",
  "title": "Sunday Setlist 9/14",
  "tracks": [
    { "id": "t1", "title": "Amazing Grace", "src": "youtube:dQw4w9WgXcQ" },
    { "id": "t2", "title": "Holy Holy",     "src": "file:track2.m4a" },
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
| `end`    | number | no       | Seconds. Stop point. Default: end of media. |

### 2.3 Cue

| field   | type    | required | description |
|---------|---------|----------|-------------|
| `page`  | integer | yes      | 1-based page index. |
| `track` | string  | yes      | A track `id`. |
| `at`    | number  | no       | Seconds into the track. Default `0`. |

**Semantics.** When page *P* becomes the current page and a cue with `page == P` exists, the
viewer selects that cue's track and seeks to `at`. If playback was active, it stays active. If no
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

## 3. Viewer conformance

| level | name       | requirement |
|-------|------------|-------------|
| 0     | Compatible | Opens the file as a PDF. Every PDF viewer already qualifies. |
| 1     | Player     | Reads the manifest, lists tracks, plays `file:` and `https:` tracks; `youtube:` via an official player. |
| 2     | Synced     | Level 1 plus: applies cues on page change, remembers last position per file, and registers the `.mpdf` extension so the OS offers the app for such files. |

**UI rules for Level 1 and above (MUST):**

- Never draw over page content. No overlays, watermarks, badges, or auto-scroll on the page.
- Player controls never sit fixed over page content: either docked outside the page area (a bar of at most 56 pt), or a floating panel the reader can move and collapse to a small pill.
- One tap stops the audio.
- No autoplay before a user gesture.
- Track switches on cue: crossfade within 300 ms, no visual flash, no page jump.
- Unknown manifest fields and unknown `src` schemes are ignored silently.

A viewer may state its level as `MPDF Level 1` or `MPDF Level 2`.

## 4. Producer rules

- Copy the source PDF unchanged. Add attachments only.
- Attachment MIME types: `application/json` for the manifest; `audio/mp4`, `audio/mpeg`,
  `audio/wav` for audio. (Informative. Consumers key on the file name, not the MIME type.)
- Refuse to produce a file whose manifest fails validation (`schema/mpdf.schema.json`).
- Refuse to add a second `mpdf.json` to a file that already has one; replace it instead.

## 5. Security

- The manifest is data. Consumers MUST NOT execute anything found in it.
- `https:` sources SHOULD be fetched over HTTPS only. Consumers MAY refuse other origins.
- Consumers MAY refuse embedded files above a size limit of their choosing.

## 6. Versioning

- Minor versions (`1.x`) only add optional fields. A `1.0` consumer plays a `1.3` file.
- A major version change (`2.0`) is a new attachment key (`mpdf2.json`) so `1.x` consumers keep working.
