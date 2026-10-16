import subprocess, tempfile, os, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
_m = None
def model():
    global _m
    if _m is None: _m = WhisperModel("base.en", device="cpu", compute_type="int8")
    return _m
def to16k(samples, sr):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, samples, sr)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", a, "-ar", "16000", "-ac", "1", b], check=True)
        x, _ = sf.read(b, dtype="float32")
    return x
def transcribe(samples, sr):
    seg, _ = model().transcribe(to16k(samples, sr), beam_size=5, language="en")
    return " ".join(s.text.strip() for s in seg)
