#!/usr/bin/env python3
"""Builds samples/: score.pdf (4 pages), two short tones, and three .mpdf files. Needs reportlab + pypdf."""
import math, os, struct, subprocess, sys, wave
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "python"))
import mpdf

SONGS = ["Amazing Grace", "Holy, Holy, Holy", "How Great Thou Art", "It Is Well"]

def make_score(path):
    c = canvas.Canvas(path, pagesize=A4); w, h = A4
    for i, title in enumerate(SONGS, 1):
        c.setFont("Helvetica-Bold", 26); c.drawString(50, h - 80, "%d. %s" % (i, title))
        c.setFont("Helvetica", 11); c.drawString(50, h - 100, "MPDF sample score - page %d of %d" % (i, len(SONGS)))
        y = h - 160
        while y > 80:                      # five-line staves so it looks like music
            for k in range(5): c.line(50, y - k * 8, w - 50, y - k * 8)
            y -= 90
        c.showPage()
    c.save()

def make_tone(path, freq, seconds=3.0, rate=22050):
    with wave.open(path, "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate)
        n = int(rate * seconds)
        f.writeframes(b"".join(struct.pack("<h", int(12000 * math.sin(2 * math.pi * freq * t / rate) * min(1, (n - t) / 2000))) for t in range(n)))

def build(name, manifest, files):
    with open(os.path.join(HERE, "score.pdf"), "rb") as f: pdf = f.read()
    out = mpdf.create(pdf, manifest, files)
    with open(os.path.join(HERE, name), "wb") as f: f.write(out)
    print("%-22s %7d bytes" % (name, len(out)))

if __name__ == "__main__":
    make_score(os.path.join(HERE, "score.pdf"))
    make_tone(os.path.join(HERE, "tone-a4.wav"), 440); make_tone(os.path.join(HERE, "tone-c5.wav"), 523.25)
    tones = {n: open(os.path.join(HERE, n), "rb").read() for n in ("tone-a4.wav", "tone-c5.wav")}
    build("youtube-only.mpdf", {"mpdf": "1.0", "title": "Sample: YouTube links only",
        "tracks": [{"id": "t1", "title": "Me at the zoo (YouTube)", "src": "youtube:jNQXAC9IVRw"}, {"id": "t2", "title": "Never Gonna Give You Up (YouTube)", "src": "youtube:dQw4w9WgXcQ"}],
        "cues": [{"page": 1, "track": "t1"}, {"page": 3, "track": "t2"}]}, {})
    build("embedded-audio.mpdf", {"mpdf": "1.0", "title": "Sample: embedded audio (offline)",
        "tracks": [{"id": "t1", "title": "Tone A4", "src": "file:tone-a4.wav"}, {"id": "t2", "title": "Tone C5", "src": "file:tone-c5.wav"}],
        "cues": [{"page": 1, "track": "t1"}, {"page": 3, "track": "t2", "at": 1.0}]}, tones)
    build("mixed.mpdf", {"mpdf": "1.0", "title": "Sample: YouTube + embedded",
        "tracks": [{"id": "t1", "title": "Me at the zoo (YouTube)", "src": "youtube:jNQXAC9IVRw"}, {"id": "t2", "title": "Tone C5", "src": "file:tone-c5.wav"}],
        "cues": [{"page": 1, "track": "t1"}, {"page": 2, "track": "t2"}, {"page": 4, "track": "t1", "at": 60}]}, {"tone-c5.wav": tones["tone-c5.wav"]})
    # CLI smoke test: same thing through the command line
    subprocess.check_call([sys.executable, os.path.join(HERE, "..", "python", "mpdf.py"), "make", os.path.join(HERE, "score.pdf"),
        "-o", os.path.join(HERE, "cli-made.mpdf"), "--title", "Made with the CLI", "--youtube", "jNQXAC9IVRw=Me at the zoo",
        "--audio", os.path.join(HERE, "tone-a4.wav") + "=Tone A4", "--cue", "1:t1", "--cue", "2:t2:0.5"])
