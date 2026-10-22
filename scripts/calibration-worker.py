#!/usr/bin/env python3
"""Immutable, observer-clocked read-to-submission protocol for blind solvers.

The clock starts before the problem is printed and stops on receipt of source.
This measures tool-inclusive elapsed wall time, never human or pure inference time.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'work' / 'reward-calibration'


def write_once(path, data):
    with open(path, 'x', encoding='utf-8') as out:
        json.dump(data, out, ensure_ascii=False, indent=2)
        out.write('\n')


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in ('begin', 'finish'):
        raise SystemExit('Usage: calibration-worker.py begin|finish TRIAL_ID')
    action, trial_id = sys.argv[1:]
    registry = json.loads((RUN / 'registry.json').read_text())
    trial = next(t for t in registry['trials'] if t['id'] == trial_id)
    task = next(t for t in registry['tasks'] if t['id'] == trial['taskId'])
    directory = RUN / 'trials'
    directory.mkdir(parents=True, exist_ok=True)
    base = directory / trial_id
    if action == 'begin':
        # Keep the timestamp and prompt retrieval in separate operations. A solver
        # cannot read the task until this external clock has already started.
        start = {**trial, 'startedMonotonicNs': time.monotonic_ns(),
                 'startedUnixNs': time.time_ns(), 'clock': 'OS monotonic_ns',
                 'promptSha256': task['promptSha256']}
        write_once(base.with_suffix('.start.json'), start)
        print(json.dumps(task['publicSpec'], ensure_ascii=False, indent=2))
    else:
        source = sys.stdin.read()
        ended_mono, ended_unix = time.monotonic_ns(), time.time_ns()
        start = json.loads(base.with_suffix('.start.json').read_text())
        if not source.strip() or len(source.encode()) > 240000:
            raise ValueError('Expected nonempty C++ source within 240KB')
        seconds = (ended_mono - start['startedMonotonicNs']) / 1e9
        if seconds <= 0:
            raise ValueError('Invalid observer clock')
        answer = base.with_suffix('.answer.cpp')
        with open(answer, 'x', encoding='utf-8') as out:
            out.write(source)
        submission = {**start, 'endedMonotonicNs': ended_mono,
                      'endedUnixNs': ended_unix, 'language': 'cpp',
                      'timing': {'valid': True, 'elapsedSeconds': seconds,
                                 'boundary': 'before prompt emission to receipt of final source; tool-inclusive wall time'},
                      'sourcePath': str(answer.relative_to(ROOT)),
                      'sourceSha256': hashlib.sha256(source.encode()).hexdigest()}
        write_once(base.with_suffix('.submission.json'), submission)
        print(json.dumps({'id': trial_id, 'saved': True}))


if __name__ == '__main__':
    main()
