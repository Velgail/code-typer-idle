#!/usr/bin/env python3
"""Select a separately declared cohort while using the original frozen observer."""
import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('raw_observer', ROOT / 'scripts/raw-explanation-worker.py')
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)
if len(sys.argv) != 4 or sys.argv[2] not in ('begin', 'explain', 'code'):
    raise SystemExit('Usage: raw-explanation-additional-worker.py COHORT begin|explain|code TRIAL_ID')
cohort, action, trial_id = sys.argv[1:]
if not cohort.startswith('additional-') or not all(c.isalnum() or c == '-' for c in cohort):
    raise SystemExit('An explicit additional cohort name is required')
observer.worker(action, trial_id, root=ROOT,
                run=ROOT / 'work' / ('raw-explanation-' + cohort),
                registry_path=ROOT / 'research' / ('raw-explanation-' + cohort + '-registry.json'),
                protocol_path=ROOT / 'research' / ('raw-explanation-' + cohort + '-protocol.json'))
