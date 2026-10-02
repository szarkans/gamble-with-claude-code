#!/usr/bin/env python3
"""Пять коротких WAV: только стандартная библиотека, без скачивания."""
import math
from pathlib import Path
import struct
import wave

RATE = 22050
# Частота, длительность, громкость; ноль — пауза.
CLIPS = {
    "spin": [(220 + i * 35, 0.045, 0.15) for i in range(12)],
    "click": [(1250, 0.035, 0.12)],
    "win": [(523, 0.10, 0.18), (659, 0.10, 0.18), (784, 0.10, 0.18), (1047, 0.22, 0.18)],
    "jackpot": [(n, 0.08, 0.17) for n in (523, 659, 784, 1047, 784, 1047, 1319)] + [(1568, 0.28, 0.17)],
    "lose": [(392, 0.12, 0.16), (311, 0.12, 0.16), (196, 0.25, 0.16)],
}


def synth(notes):
    data = bytearray()
    for freq, seconds, gain in notes:
        length = round(seconds * RATE)
        for i in range(length):
            t = i / RATE
            envelope = min(1, i / (RATE * 0.005), (length - i - 1) / (RATE * 0.02))
            # Квадрат с мягким синусом и огибающей: чиптюн без щелчка на стыке.
            sine = math.sin(2 * math.pi * freq * t)
            sample = gain * envelope * (0.6 * (1 if sine >= 0 else -1) + 0.4 * sine)
            data.extend(struct.pack("<h", round(sample * 32767)))
    return data


def main():
    target = Path(__file__).resolve().parents[1] / "sounds"
    target.mkdir(exist_ok=True)
    for name, notes in CLIPS.items():
        path = target / f"{name}.wav"
        with wave.open(str(path), "wb") as clip:
            clip.setnchannels(1)
            clip.setsampwidth(2)
            clip.setframerate(RATE)
            clip.writeframes(synth(notes))
        print(f"{path.name}: {path.stat().st_size} байт")


if __name__ == "__main__":
    main()
