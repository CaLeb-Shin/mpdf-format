import io, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mpdf
from pypdf import PdfReader, PdfWriter

w = PdfWriter()
for _ in range(3): w.add_blank_page(400, 500)
b = io.BytesIO(); w.write(b); plain = b.getvalue()
assert mpdf.read(plain) is None, "plain PDF is not MPDF"

audio = bytes(range(256)) * 4
m = {"mpdf": "1.0", "title": "Test", "tracks": [{"id": "t1", "src": "youtube:dQw4w9WgXcQ"}, {"id": "t2", "src": "file:tone.wav"}],
     "cues": [{"page": 3, "track": "t2", "at": 1.5}]}
out = mpdf.create(plain, m, {"tone.wav": audio})
m2, files = mpdf.read(out)
assert m2 == m and files == {"tone.wav": audio}
assert len(PdfReader(io.BytesIO(out)).pages) == 3, "still a 3-page PDF"
try:
    mpdf.create(out, m, {"tone.wav": audio}); raise AssertionError("should refuse a second mpdf.json")
except ValueError as e:
    assert "already" in str(e)
assert len(mpdf.validate({"mpdf": "1.0", "tracks": [{"id": "x", "src": "file:missing"}], "cues": [{"page": 0, "track": "nope"}]}, [])) == 3

p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "samples", "js-made.mpdf")
if os.path.exists(p):
    with open(p, "rb") as f: m3, _ = mpdf.read(f.read())
    assert m3["mpdf"] == "1.0" and m3["title"] == "Made with pdf-lib"
    print("python reads js sample: ok")
print("python: all ok")
