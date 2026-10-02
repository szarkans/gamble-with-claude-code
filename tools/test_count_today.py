"""Регрессии счётчика на искусственных журналах, без чтения домашней папки."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("count_today.py")


def load_counter(config):
    with patch.dict(os.environ, {"CLAUDE_CONFIG_DIR": str(config)}):
        spec = importlib.util.spec_from_file_location("counter_fixture", SCRIPT)
        counter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(counter)
    return counter


def record(output=3):
    return json.dumps({
        "type": "assistant", "timestamp": datetime.now().astimezone().isoformat(),
        "requestId": "fixture-request", "message": {
            "id": "fixture-message", "usage": {
                "input_tokens": 2, "cache_creation_input_tokens": 5,
                "cache_read_input_tokens": 999, "output_tokens": output,
            },
        },
    }, ensure_ascii=False) + "\n"


class CounterTest(unittest.TestCase):
    def test_isolated_process_uses_config_dir_and_latest_usage(self):
        with tempfile.TemporaryDirectory() as config:
            logs = Path(config, "projects", "fixture")
            logs.mkdir(parents=True)
            Path(logs, "session.jsonl").write_text(record(1) + record(3) + "broken\n", encoding="utf-8")
            env = dict(os.environ, CLAUDE_CONFIG_DIR=config, PYTHONPATH="/fixture/ignored")
            completed = subprocess.run([sys.executable, "-I", str(SCRIPT)], env=env,
                                       capture_output=True, text=True, check=True)
            value = json.loads(completed.stdout)
            self.assertEqual(value["total"], 10)
            self.assertEqual(value["date"], datetime.now().date().isoformat())
            self.assertGreater(value["midnight"], datetime.now().timestamp() * 1000)

    def test_unreadable_and_disappeared_files_do_not_abort_count(self):
        with tempfile.TemporaryDirectory() as config:
            good = Path(config, "good.jsonl")
            denied = Path(config, "denied.jsonl")
            missing = Path(config, "disappeared.jsonl")
            good.write_text(record(), encoding="utf-8")
            denied.write_text(record(500), encoding="utf-8")
            counter = load_counter(config)
            real_open = open

            def fixture_open(path, *args, **kwargs):
                if Path(path) == denied:
                    raise PermissionError("synthetic unreadable file")
                return real_open(path, *args, **kwargs)

            with patch.object(counter.glob, "glob", return_value=[str(denied), str(missing), str(good)]), \
                    patch("builtins.open", side_effect=fixture_open):
                self.assertEqual(counter.claude(), 10)

    def test_missing_config_dir_is_an_empty_day(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(load_counter(Path(directory, "missing")).claude(), 0)

    def test_unset_config_dir_defaults_to_claude(self):
        with patch.dict(os.environ, {}, clear=True):
            counter = load_counter("")
            self.assertEqual(counter.CONFIG, os.path.join(os.path.expanduser("~"), ".claude"))


if __name__ == "__main__":
    unittest.main()
