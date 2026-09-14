#!/usr/bin/env python3
"""MPDF reference implementation and CLI (Python 3.8+). MIT.  Requires: pip install pypdf

  mpdf.py make score.pdf -o out.mpdf --youtube dQw4w9WgXcQ="Amazing Grace" --audio track2.m4a --cue 1:t1 --cue 4:t2:32.5
  mpdf.py info out.mpdf
  mpdf.py extract out.mpdf outdir/
"""
import argparse, io, json, os, re, sys
from pypdf import PdfReader, PdfWriter

MANIFEST_NAME = "mpdf.json"
SPEC_VERSION = "1.0"
_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def validate(m, file_names=None):
    """Return a list of problems (empty list = valid). file_names: keys of embedded files, or None to skip that check."""
    e = []
    if not isinstance(m, dict):
        return ["manifest must be an object"]
    if not isinstance(m.get("mpdf"), str) or not m["mpdf"].startswith("1."):
        e.append('mpdf must be "1.x"')
    tracks = m.get("tracks")
    if not isinstance(tracks, list) or not tracks:
        e.append("tracks must be a non-empty array"); tracks = []
    ids = set()
    for i, t in enumerate(tracks):
        t = t if isinstance(t, dict) else {}
        tid, src = t.get("id"), t.get("src")
        if not isinstance(tid, str) or not _ID.match(tid):
            e.append("tracks[%d].id invalid" % i)
        elif tid in ids:
            e.append("tracks[%d].id duplicate: %s" % (i, tid))
        ids.add(tid)
        if not isinstance(src, str) or not src:
            e.append("tracks[%d].src missing" % i)
        elif file_names is not None and src.startswith("file:") and src[5:] not in file_names:
            e.append("tracks[%d].src refers to missing file %s" % (i, src[5:]))
    for i, c in enumerate(m.get("cues") or []):
        c = c if isinstance(c, dict) else {}
        p, at = c.get("page"), c.get("at")
        if not (isinstance(p, int) and not isinstance(p, bool) and p >= 1):
            e.append("cues[%d].page must be an integer >= 1" % i)
        if c.get("track") not in ids:
            e.append("cues[%d].track unknown: %s" % (i, c.get("track")))
        if at is not None and not (isinstance(at, (int, float)) and not isinstance(at, bool) and at >= 0):
            e.append("cues[%d].at must be >= 0" % i)
    return e


def create(pdf_bytes, manifest, files=None):
    """pdf_bytes: a normal PDF. files: {"track2.m4a": bytes}. Returns the .mpdf bytes."""
    files = files or {}
    errors = validate(manifest, list(files))
    if errors:
        raise ValueError("invalid manifest: " + "; ".join(errors))
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if MANIFEST_NAME in reader.attachments:
        raise ValueError("PDF already contains mpdf.json")
    w = PdfWriter(clone_from=reader)
    w.add_attachment(MANIFEST_NAME, json.dumps(manifest, indent=2, ensure_ascii=False).encode("utf-8"))
    for name, data in files.items():
        w.add_attachment(name, data)
    out = io.BytesIO(); w.write(out)
    return out.getvalue()


def read(pdf_bytes):
    """Returns (manifest, files) or None when the PDF is not an MPDF."""
    att = PdfReader(io.BytesIO(pdf_bytes)).attachments
    if MANIFEST_NAME not in att:
        return None
    manifest = json.loads(att[MANIFEST_NAME][0].decode("utf-8"))
    if not isinstance(manifest.get("mpdf"), str) or not manifest["mpdf"].startswith("1."):
        return None
    return manifest, {n: v[0] for n, v in att.items() if n != MANIFEST_NAME}


def _split(v):  # "value=Title" -> (value, title or None)
    a, _, b = v.partition("=")
    return a, (b or None)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="mpdf", description="Make and inspect MPDF files (a PDF with a playlist attached).")
    sub = ap.add_subparsers(dest="cmd"); sub.required = True
    mk = sub.add_parser("make", help="attach tracks to a PDF")
    mk.add_argument("pdf"); mk.add_argument("-o", "--out", required=True); mk.add_argument("--title")
    mk.add_argument("--youtube", action="append", default=[], metavar="ID[=TITLE]")
    mk.add_argument("--audio", action="append", default=[], metavar="PATH[=TITLE]")
    mk.add_argument("--url", action="append", default=[], metavar="URL[=TITLE]")
    mk.add_argument("--cue", action="append", default=[], metavar="PAGE:TRACK[:SECONDS]", help="e.g. 4:t2:32.5  (tracks are t1, t2, ... in order: youtube, audio, url)")
    inf = sub.add_parser("info", help="print the manifest"); inf.add_argument("file")
    ex = sub.add_parser("extract", help="write mpdf.json and embedded files to a directory"); ex.add_argument("file"); ex.add_argument("outdir")
    a = ap.parse_args(argv)

    if a.cmd == "make":
        tracks, files = [], {}
        for v in a.youtube:
            vid, title = _split(v); tracks.append({"id": "t%d" % (len(tracks) + 1), "src": "youtube:" + vid, **({"title": title} if title else {})})
        for v in a.audio:
            path, title = _split(v); name = os.path.basename(path)
            with open(path, "rb") as f: files[name] = f.read()
            tracks.append({"id": "t%d" % (len(tracks) + 1), "src": "file:" + name, "title": title or os.path.splitext(name)[0]})
        for v in a.url:
            url, title = _split(v); tracks.append({"id": "t%d" % (len(tracks) + 1), "src": url, **({"title": title} if title else {})})
        cues = []
        for v in a.cue:
            parts = v.split(":"); cue = {"page": int(parts[0]), "track": parts[1]}
            if len(parts) > 2: cue["at"] = float(parts[2])
            cues.append(cue)
        manifest = {"mpdf": SPEC_VERSION, "tracks": tracks}
        if a.title: manifest["title"] = a.title
        if cues: manifest["cues"] = cues
        with open(a.pdf, "rb") as f: out = create(f.read(), manifest, files)
        with open(a.out, "wb") as f: f.write(out)
        print("wrote %s (%d tracks, %d cues, %d bytes)" % (a.out, len(tracks), len(cues), len(out)))
    else:
        with open(a.file, "rb") as f: r = read(f.read())
        if r is None: sys.exit("not an MPDF file (no mpdf.json attachment)")
        manifest, files = r
        if a.cmd == "info":
            print(json.dumps(manifest, indent=2, ensure_ascii=False))
            for n, b in files.items(): print("embedded: %s (%d bytes)" % (n, len(b)))
        else:
            os.makedirs(a.outdir, exist_ok=True)
            with open(os.path.join(a.outdir, MANIFEST_NAME), "w", encoding="utf-8") as f: json.dump(manifest, f, indent=2, ensure_ascii=False)
            for n, b in files.items():
                with open(os.path.join(a.outdir, os.path.basename(n)), "wb") as f: f.write(b)
            print("extracted %d files to %s" % (len(files) + 1, a.outdir))


if __name__ == "__main__":
    main()
