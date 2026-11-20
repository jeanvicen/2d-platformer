"""Sons originais do DR-0N, sintetizados do zero (numpy) e codificados em OGG pelo ffmpeg.
Nada é copiado de jogos/filmes: rotor, motores, jato, canhão, metralhadora, pisão, rugido
mecânico, raio de plasma, servo, míssil, transformação e o "split" do exército.
No jogo eles são tocados junto com sons do próprio Minecraft (explosões, passos) para peso."""
from __future__ import annotations

import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 32000
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def noise(dur):
    return rng.standard_normal(int(SR * dur))


def band(x, lo=0.0, hi=SR / 2, tilt=0.0):
    """Filtro passa-faixa no domínio da frequência (+ inclinação opcional)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    # bordas suaves
    if lo > 0:
        m *= np.clip((f - lo * 0.7) / (lo * 0.3 + 1e-9), 0, 1)
    if hi < SR / 2:
        m *= np.clip((hi * 1.3 - f) / (hi * 0.3 + 1e-9), 0, 1)
    if tilt:
        m *= (np.maximum(f, 20) / 1000.0) ** tilt
    return np.fft.irfft(X * m, len(x))


def env(n, a=0.01, r=0.2, total=None):
    total = total or n / SR
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.clip((total - t) / max(r, 1e-4), 0, 1)
    return e


def saw(freq, dur):
    ph = np.cumsum(np.broadcast_to(freq, int(SR * dur)) / SR)
    return 2 * (ph % 1) - 1


def sine(freq, dur):
    ph = np.cumsum(np.broadcast_to(freq, int(SR * dur)) / SR)
    return np.sin(2 * np.pi * ph)


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def soft(x, k=2.0):
    return np.tanh(x * k) / np.tanh(k)


def loopable(x, fade=0.06):
    """Cruzamento nas pontas para o som repetir sem estalo."""
    n = int(SR * fade)
    head, tail = x[:n].copy(), x[-n:].copy()
    w = np.linspace(0, 1, n)
    x = x[:-n].copy()
    x[:n] = head * w + tail * (1 - w)
    return x


# ------------------------------------------------------------------ sons
def s_heli():
    d = 1.0
    t = t_(d)
    chop = (0.5 + 0.5 * np.cos(2 * np.pi * 12 * t)) ** 6           # "wop wop" das pás
    body = band(noise(d), 60, 900) * chop * 1.6
    turbine = sine(1850 + 30 * np.sin(2 * np.pi * 0.7 * t), d) * 0.05 + band(noise(d), 2500, 6000) * 0.08
    return loopable(norm(soft(body + turbine, 1.6)))


def s_engine():
    d = 1.0
    t = t_(d)
    f0 = 52 + 4 * np.sin(2 * np.pi * 1.0 * t)
    x = saw(f0, d) * 0.6 + saw(f0 * 2.01, d) * 0.3 + saw(f0 * 0.5, d) * 0.4
    x = band(x, 30, 1400) + band(noise(d), 200, 1200) * 0.15 * (0.5 + 0.5 * np.sin(2 * np.pi * f0 * t))
    return loopable(norm(soft(x, 2.4)))


def s_jet():
    d = 1.2
    t = t_(d)
    roar = band(noise(d), 80, 5000, tilt=-0.6) * 1.2
    whine = sine(3200 + 60 * np.sin(2 * np.pi * 0.5 * t), d) * 0.08 + sine(4810, d) * 0.03
    rumble = band(noise(d), 20, 120) * 1.5
    return loopable(norm(soft(roar + whine + rumble, 1.4)))


def s_cannon():
    d = 1.8
    t = t_(d)
    blast = band(noise(d), 20, 2500, tilt=-0.8) * np.exp(-t * 5)
    boom = sine(48 * np.exp(-t * 1.2) + 22, d) * np.exp(-t * 2.2) * 1.4
    crack = band(noise(d), 1500, 9000) * np.exp(-t * 40) * 0.8
    tail = band(noise(d), 20, 300) * np.exp(-t * 1.6) * 0.6
    return norm(soft(blast + boom + crack + tail, 2.2))


def s_gatling():
    d = 0.6
    t = t_(d)
    x = np.zeros_like(t)
    for k in np.arange(0, d - 0.05, 1 / 28):
        i = int(k * SR)
        n = int(0.04 * SR)
        shot = band(noise(0.04), 300, 7000, tilt=-0.3) * np.exp(-np.arange(n) / SR * 90)
        shot += sine(140, 0.04) * np.exp(-np.arange(n) / SR * 60) * 0.7
        x[i:i + n] += shot[: len(x[i:i + n])]
    whirr = band(noise(d), 600, 2200) * 0.12
    return norm(soft(x + whirr, 1.8) * env(len(t), 0.005, 0.08))


def s_stomp():
    d = 1.6
    t = t_(d)
    thud = sine(38 * np.exp(-t * 1.5) + 18, d) * np.exp(-t * 3) * 1.6
    impact = band(noise(d), 20, 700) * np.exp(-t * 9) * 1.2
    debris = band(noise(d), 300, 4000) * np.exp(-t * 2.8) * (0.3 + 0.7 * (rng.random(len(t)) > 0.996)) * 0.5
    metal = sine(220, d) * np.exp(-t * 6) * 0.15 + sine(331, d) * np.exp(-t * 7) * 0.1
    return norm(soft(thud + impact + debris + metal, 2.0))


def s_roar():
    d = 2.8
    t = t_(d)
    shape = np.clip(t / 0.35, 0, 1) * np.clip((d - t) / 0.9, 0, 1)
    f0 = 70 + 25 * np.sin(np.pi * t / d) + 6 * np.sin(2 * np.pi * 7 * t)
    voice = saw(f0, d) + 0.6 * saw(f0 * 1.5, d) + 0.4 * saw(f0 * 2.02, d)
    formant = band(voice, 150, 900) * 1.2 + band(voice, 1200, 2600) * 0.5
    growl = band(noise(d), 60, 1800) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * t))
    mech = sine(f0 * 8, d) * 0.05 + band(noise(d), 3000, 8000) * 0.12
    return norm(soft((formant + growl * 0.8 + mech) * shape, 3.0))


def s_beam():
    d = 1.0
    t = t_(d)
    hum = sine(110, d) * 0.5 + sine(220.5, d) * 0.3 + sine(331, d) * 0.15
    hum *= 0.8 + 0.2 * np.sin(2 * np.pi * 9 * t)
    crackle = band(noise(d), 2000, 10000) * (rng.random(len(t)) > 0.97) * 1.5
    roar = band(noise(d), 100, 3000) * 0.6
    return loopable(norm(soft(hum + crackle + roar, 2.0)))


def s_servo():
    d = 0.55
    t = t_(d)
    f = 380 + 900 * np.sin(np.pi * t / d)
    x = saw(f, d) * 0.4 + band(noise(d), 1500, 5000) * 0.2
    return norm(band(x, 200, 6000) * env(len(t), 0.03, 0.12))


def s_missile():
    d = 1.4
    t = t_(d)
    whoosh = band(noise(d), 300, 6000, tilt=0.4) * np.exp(-((t - 0.25) / 0.5) ** 2) * 1.2
    ignite = band(noise(d), 100, 2000) * np.exp(-t * 12)
    return norm(soft(whoosh + ignite, 1.5))


def s_transform():
    d = 2.0
    t = t_(d)
    x = np.zeros_like(t)
    for k, start in enumerate((0.0, 0.22, 0.45, 0.7, 0.95, 1.25)):
        n = int(0.35 * SR)
        i = int(start * SR)
        tt = np.arange(n) / SR
        f = 300 + (k % 3) * 160 + 700 * tt / 0.35
        piece = (saw(f, 0.35) * 0.3 + band(noise(0.35), 1000, 5000) * 0.2)[:n] * np.sin(np.pi * tt / 0.35)
        x[i:i + n] += piece[: len(x[i:i + n])]
        cl = int(0.08 * SR)
        clank = (sine(1400 + k * 210, 0.08) + sine(2300 + k * 170, 0.08) * 0.6) * np.exp(-np.arange(cl) / SR * 45)
        j = i + int(0.3 * SR)
        x[j:j + cl] += clank[: len(x[j:j + cl])] * 0.9
    thump = sine(55, d) * np.exp(-np.maximum(0, t - 1.55) * 7) * (t > 1.55) * 1.4
    return norm(soft(x + thump, 1.8))


def s_split():
    d = 1.6
    t = t_(d)
    burst = band(noise(d), 80, 6000, tilt=-0.4) * np.exp(-t * 4) * 1.3
    chime = sum(sine(f, d) * np.exp(-t * (3 + i)) * 0.25 for i, f in enumerate((880, 1320, 1760, 2640)))
    sweep = sine(200 + 2400 * t / d, d) * np.exp(-t * 2) * 0.2
    return norm(soft(burst + chime + sweep, 1.6))


def s_laser():
    d = 0.3
    t = t_(d)
    f = 2400 * np.exp(-t * 14) + 300
    return norm(sine(f, d) * np.exp(-t * 12) + band(noise(d), 3000, 9000) * np.exp(-t * 40) * 0.3)


SOUNDS = {
    "heli": s_heli, "engine": s_engine, "jet": s_jet, "cannon": s_cannon, "gatling": s_gatling,
    "stomp": s_stomp, "roar": s_roar, "beam": s_beam, "servo": s_servo, "missile": s_missile,
    "transform": s_transform, "split": s_split, "laser": s_laser,
}


def write_ogg(path, x):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    try:
        with wave.open(tmp, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "3", path], check=True)
    finally:
        os.unlink(tmp)


def build_sounds(rp):
    defs = {}
    for name, fn in SOUNDS.items():
        write_ogg(os.path.join(rp, "sounds", "lila", f"{name}.ogg"), fn())
        defs[f"lila.{name}"] = {"category": "neutral", "min_distance": 4.0, "max_distance": 96.0 if name in ("roar", "stomp", "cannon") else 48.0,
                                "sounds": [{"name": f"sounds/lila/{name}", "volume": 1.0, "load_on_low_memory": True}]}
    return {"format_version": "1.14.0", "sound_definitions": defs}
