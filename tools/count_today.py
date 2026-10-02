#!/usr/bin/env python3
"""Чистые input+output токены Claude Code за сегодня (локальные сутки).
Печатает JSON {"total": N}."""
import glob, json, os
from datetime import datetime

H = os.path.expanduser("~")
midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
t0 = midnight.timestamp()

def today(ts):  # ISO 'Z' -> epoch
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() >= t0

def claude():
    last = {}  # (msg id, requestId) -> usage; последняя строка побеждает
    for f in glob.glob(f"{H}/.claude/projects/**/*.jsonl", recursive=True):
        if os.path.getmtime(f) < t0:
            continue
        for line in open(f, errors="ignore"):
            if '"assistant"' not in line or '"usage"' not in line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            m = d.get("message") or {}
            u = m.get("usage")
            if d.get("type") != "assistant" or not u or not today(d.get("timestamp", "1970-01-01T00:00:00Z")):
                continue
            last[(m.get("id"), d.get("requestId"))] = u
    # У Anthropic новый вход хода лежит в cache_creation (Claude Code кэширует всё новое), а input_tokens —
    # только хвост после точки кэша. Новое = input + cache_creation; cache_read (перечитанное) не считаем.
    return sum((u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) + (u.get("output_tokens") or 0)
               for u in last.values())

CODEX_ROOTS = [f"{H}/.codex"] + glob.glob("/mnt/c/Users/*/.codex")  # WSL + Codex-приложение на Windows


if __name__ == "__main__":
    print(json.dumps({"total": claude()}))
