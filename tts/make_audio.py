"""M4 試作：script.json -> full.mp3 + timing.json（只做 gym-0002）。
用法：python make_audio.py <set_dir> <out_dir> [--pause 20] [--no-asr]"""
import sys, re, json, hashlib, subprocess, os, argparse
import numpy as np
from kokoro_onnx import Kokoro

SR = 24000
VOICES = {"announcer": ("bm_george", "en-gb"), "A": ("am_michael", "en-us"), "B": ("bf_emma", "en-gb")}
LETTER = dict(A="ay",B="bee",C="see",D="dee",E="ee",F="eff",G="jee",H="aitch",I="eye",J="jay",K="kay",L="ell",M="em",N="en",O="oh",P="pee",Q="cue",R="ar",S="ess",T="tee",U="you",V="vee",W="double you",X="ex",Y="why",Z="zed")
DIGIT = "zero one two three four five six seven eight nine".split()

def prep(text):
    # 拼字：R-H-I-A -> "ar, aitch, eye, ay."
    text = re.sub(r"\b(?:[A-Z]-){2,}[A-Z]\b", lambda m: "... ".join(LETTER[c] for c in m.group(0).split("-")) + "...,", text)
    # 4 位以上純數字（房號、郵遞區號、編號）逐位念
    text = re.sub(r"(?<![\d£$.,])\d{4,}(?![\d,.]\d)", lambda m: " ".join(DIGIT[int(c)] for c in m.group(0)), text)
    return text

class Voice:
    def __init__(self, cache_dir):
        self.k = Kokoro("models/kokoro-v1.0.onnx", "models/voices-v1.0.bin")
        self.cache = cache_dir; os.makedirs(cache_dir, exist_ok=True)
    def say(self, text, role, speed=None):
        voice, lang = VOICES[role]
        t = prep(text)
        key = hashlib.sha1(f"{voice}|{lang}|{t}|{speed}".encode()).hexdigest()[:16]
        f = f"{self.cache}/{key}.npy"
        if os.path.exists(f): return np.load(f)
        s, sr = self.k.create(t, voice=voice, speed=speed or (0.95 if role != "announcer" else 0.92), lang=lang)
        assert sr == SR
        np.save(f, s.astype(np.float32)); return s.astype(np.float32)

SPELL_RE = re.compile(r"\b(?:[A-Z]-){2,}[A-Z]\b")
SPELL_PAUSE = 0.6
LETTER_GAP = 0.25   # 字母之間的靜音秒數

def regap(s, n, gap=LETTER_GAP, frame=240):
    """把一串字母音檔在 n-1 個最長的靜音處切開，字母間改成固定 gap 秒。找不到足夠的靜音就原樣回傳。"""
    rms = np.sqrt(np.convolve(s ** 2, np.ones(frame) / frame, mode="same"))[::frame // 2]
    quiet = rms < 0.12 * rms.max()
    runs, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            if i > 0 and j < len(quiet): runs.append((j - i, i, j))
            i = j
        else: i += 1
    if len(runs) < n - 1: return s
    cuts = sorted(sorted(runs, reverse=True)[: n - 1], key=lambda r: r[1])
    hop, pieces, prev = frame // 2, [], 0
    for _, a, b in cuts:
        pieces.append(s[prev: a * hop]); prev = b * hop
    pieces.append(s[prev:])
    out = []
    for p in pieces: out += [p, silence(gap)]
    return np.concatenate(out[:-1])

def say_turn(V, text, role):
    """拼字前後切開：名字念完停 SPELL_PAUSE 秒再拼，拼完也停一下再接後面的話。"""
    out, last = [], 0
    for m in SPELL_RE.finditer(text):
        pre = text[last:m.start()].strip()
        if pre: out += [V.say(pre, role), silence(SPELL_PAUSE)]
        out += [regap(V.say(m.group(0), role, speed=0.8), m.group(0).count("-") + 1), silence(0.4)]
        last = m.end()
    rest = text[last:].lstrip(" .,")
    if rest or not out: out.append(V.say(rest or text, role))
    return np.concatenate(out)

def silence(sec): return np.zeros(int(SR * sec), dtype=np.float32)


def qrange(g): return f"{g['first']} and {g['last']}" if g["last"] - g["first"] == 1 else (str(g["first"]) if g["first"] == g["last"] else f"{g['first']} to {g['last']}")

def plan_groups(paper_path, script, min_size=2, max_size=5):
    """由答題卷分段 + 腳本 evidence 推算題組與停頓點。規則：
    1) 每個 section 一組；2) 少於 min_size 題的組併入下一組（最後一組併入前一組）；
    3) 停頓放在該組最後一題證據句之後；證據句順序若與題組衝突則報錯。"""
    paper = json.load(open(paper_path))
    qn, secs = 0, []
    for r in paper["rows"]:
        n = sum(1 for p in r.get("parts", []) if p.get("blank")) if "parts" in r else (1 if r.get("field_id") else 0)
        if not n: continue
        sec = r.get("section") or ""
        for _ in range(n):
            qn += 1
            if secs and secs[-1]["section"] == sec: secs[-1]["last"] = qn
            else: secs.append({"section": sec, "first": qn, "last": qn})
    gs = []
    for g in secs:
        if gs and gs[-1]["last"] - gs[-1]["first"] + 1 < min_size:
            gs[-1].update(last=g["last"], section=gs[-1]["section"] + " + " + g["section"])
        else: gs.append(dict(g))
    if len(gs) > 1 and gs[-1]["last"] - gs[-1]["first"] + 1 < min_size:
        last = gs.pop(); gs[-1].update(last=last["last"])
    idx = {t["id"]: i for i, t in enumerate(script["turns"])}
    ev = {int(e["question_id"][1:]): idx[e["turn"]] for e in script["evidence"]}
    for k, g in enumerate(gs):
        g["max_ev"] = max(ev[q] for q in range(g["first"], g["last"] + 1))
        g["min_ev"] = min(ev[q] for q in range(g["first"], g["last"] + 1))
    for k, g in enumerate(gs):
        g["t0"] = 0 if k == 0 else gs[k - 1]["t1"] + 1
        if k < len(gs) - 1:
            if g["max_ev"] >= gs[k + 1]["min_ev"]:
                sys.exit(f"證據句順序與題組衝突：q{g['first']}-{g['last']} 的證據在第 {g['max_ev']+1} 句，下一組最早在第 {gs[k+1]['min_ev']+1} 句")
            g["t1"] = g["max_ev"]
            g["break_after"] = script["turns"][g["t1"]]["id"]
        else:
            g["t1"] = len(script["turns"]) - 1; g["break_after"] = None
    return gs

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("set_dir"); ap.add_argument("out_dir")
    ap.add_argument("--pause", type=float, default=20); ap.add_argument("--check", type=float, default=30)
    ap.add_argument("--no-asr", action="store_true")
    ap.add_argument("--scenario", default="You will hear a university student joining a fitness club.")
    a = ap.parse_args()
    script = json.load(open(f"{a.set_dir}/script.json"))
    turns = script["turns"]
    groups = plan_groups(f"{a.set_dir}/paper.json", script)
    for g in groups: print("group q%d-%d [%s] break after %s" % (g["first"], g["last"], g["section"], g["break_after"]))
    V = Voice("slice_cache"); os.makedirs(a.out_dir, exist_ok=True)
    parts, events, pos = [], [], 0
    def add(audio, ev):
        nonlocal pos
        ev = dict(ev, start=round(pos / SR, 2), end=round((pos + len(audio)) / SR, 2)); events.append(ev)
        parts.append(audio); pos += len(audio)
    def announce(id_, text): add(V.say(text, "announcer"), {"type": "announce", "id": id_, "text": text})
    def pause(id_, sec, q): add(silence(sec), {"type": "pause", "id": id_, "seconds": sec, "questions": q})
    announce("intro", "Section 1. Listen and answer questions 1 to %d. " % groups[-1]["last"] + a.scenario)
    by_break = {g["break_after"]: i for i, g in enumerate(groups[:-1])}
    for i, g in enumerate(groups):
        qs = qrange(g)
        if i == 0:
            announce("look1", f"First you have some time to look at questions {qs}.")
        pause(f"pause{i+1}", a.pause, [g["first"], g["last"]])
        announce(f"now{i+1}", f"Now listen and answer questions {qs}." if i == 0 else f"Now listen to the rest of the conversation and answer questions {qs}.")
        for t in turns[g["t0"]:g["t1"] + 1]:
            add(say_turn(V, t["text"], t["speaker"]), {"type": "turn", "id": t["id"], "speaker": t["speaker"], "text": t["text"], "group": i + 1})
            add(silence(0.5 if t["speaker"] == "A" else 0.7), {"type": "gap"})
        if i < len(groups) - 1:
            nq = qrange(groups[i + 1])
            announce(f"look{i+2}", f"Before you hear the rest of the conversation, you have some time to look at questions {nq}.")
    announce("end", "That is the end of Section 1. You now have 30 seconds to check your answers.")
    pause("check", a.check, [1, groups[-1]["last"]])
    audio = np.concatenate(parts)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", "-b:a", "64k", f"{a.out_dir}/full.mp3"], input=pcm, check=True)
    events = [e for e in events if e["type"] != "gap"]
    json.dump({"set_id": script["set_id"], "total_seconds": round(len(audio) / SR, 1), "events": events}, open(f"{a.out_dir}/timing.json", "w"), indent=1, ensure_ascii=False)
    talk = sum(e["end"] - e["start"] for e in events if e["type"] in ("turn", "announce"))
    print("total %.1f s (%.1f min); speech+announce %.1f s; pauses %.1f s" % (len(audio)/SR, len(audio)/SR/60, talk, sum(e["seconds"] for e in events if e["type"]=="pause")))
    if not a.no_asr:
        from asr import transcribe
        norm = lambda s: re.findall(r"[a-z']+", s.lower())
        bad = 0
        for e in events:
            if e["type"] != "turn": continue
            i0, i1 = int(e["start"] * SR), int(e["end"] * SR)
            heard = set(norm(transcribe(audio[i0:i1], SR))); want = norm(prep(e["text"]))
            miss = sum(w not in heard for w in want) / len(want)
            if miss > 0.2: bad += 1; print("  check", e["id"], f"{miss:.0%} words not heard")
        print("ASR flagged turns:", bad)
if __name__ == "__main__":
    main()
