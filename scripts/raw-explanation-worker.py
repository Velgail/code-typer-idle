#!/usr/bin/env python3
"""Preserve exact fresh public explanations and observer intervals, without rewriting."""
import hashlib
import json
from pathlib import Path
import platform
import sys
import tempfile
import time
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'work' / 'raw-explanation-calibration'
REGISTRY = ROOT / 'research' / 'raw-explanation-registry.json'
PROTOCOL = ROOT / 'research' / 'raw-explanation-protocol.json'
# Unicode White_Space property. This deliberately differs from Python str.isspace
# for four legacy C0 separators, and from ECMAScript \s for U+0085 / U+FEFF.
WHITE_SPACE = frozenset(chr(c) for c in (
    *range(0x0009, 0x000E), 0x0020, 0x0085, 0x00A0, 0x1680,
    *range(0x2000, 0x200B), 0x2028, 0x2029, 0x202F, 0x205F, 0x3000))
EXTENSIONS = {'cpp': 'cpp', 'csharp': 'cs', 'rust': 'rs', 'go': 'go',
              'python': 'py', 'java': 'java', 'sql': 'sql', 'lua': 'lua'}


def sha(value):
    return hashlib.sha256(value).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def write_once_bytes(path, value):
    with path.open('xb') as output:
        output.write(value)


def write_once(path, value):
    write_once_bytes(path, json_bytes(value))


def metrics(raw):
    text = raw.decode('utf-8', errors='strict')
    return {
        'unicodeCharacters': len(text),
        'utf8Bytes': len(raw),
        'charactersExcludingUnicodeWhiteSpace': sum(c not in WHITE_SPACE for c in text),
        'whitespacePolicy': 'Unicode White_Space; fixed 25-code-point set; no normalization',
    }


def boot_id():
    try:
        return Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    except OSError:
        return None


def worker(action, trial_id, *, root=ROOT, run=RUN, registry_path=REGISTRY,
           protocol_path=PROTOCOL, payload=None, emit=True):
    registry_raw = registry_path.read_bytes()
    protocol_raw = protocol_path.read_bytes()
    registry = json.loads(registry_raw)
    protocol = json.loads(protocol_raw)
    if registry['experimentId'] != protocol['experimentId']:
        raise ValueError('Registry/protocol experiment mismatch')
    trial = next(t for t in registry['trials'] if t['id'] == trial_id)
    task = next(t for t in registry['tasks'] if t['id'] == trial['taskId'])
    directory = run / 'trials'
    directory.mkdir(parents=True, exist_ok=True)
    base = directory / trial_id
    if action == 'begin':
        prompt = {'instructions': registry['publicInstructions'], 'problem': task['publicSpec']}
        prompt_raw = json_bytes(prompt)
        # JS's pretty-printed prompt uses the same JSON structure but a different
        # inline empty-object formatting. Hash the exact emitted bytes, not a
        # language-specific reconstruction of registry JSON.
        public_structure_sha = task.get('promptSha256')
        if base.with_suffix('.start.json').exists():
            raise FileExistsError('An observation may begin only once')
        if sha(Path(__file__).read_bytes()) != protocol['worker']['sha256']:
            raise ValueError('Worker differs from the frozen protocol')
        record = {
            'schemaVersion': 2, 'experimentId': registry['experimentId'],
            'registrySha256': sha(registry_raw), 'protocolSha256': sha(protocol_raw),
            **trial, 'observerBootId': boot_id(),
            'observer': {'platform': platform.platform(), 'python': platform.python_version(),
                         'unicodeDatabase': unicodedata.unidata_version},
            'publicPromptStructureSha256': public_structure_sha,
            'promptSha256': sha(prompt_raw),
            'promptPath': str(base.with_suffix('.prompt.json').relative_to(root)),
        }
        # Prepare all prompt and observer metadata before sampling. File writing
        # and transport after these samples are part of the observed wall time.
        write_once_bytes(base.with_suffix('.prompt.json'), prompt_raw)
        record['startedMonotonicNs'] = str(time.monotonic_ns())
        record['startedUnixNs'] = str(time.time_ns())
        write_once(base.with_suffix('.start.json'), record)
        if emit:
            sys.stdout.buffer.write(prompt_raw)
            sys.stdout.buffer.flush()
        return record
    if payload is None:
        payload = sys.stdin.buffer.read()
    ended_mono, ended_unix = time.monotonic_ns(), time.time_ns()
    # Preserve even malformed/empty payloads as failures. Validation never changes
    # the received bytes and happens after the observer clock is sampled.
    raw_path = base.with_suffix('.explanation.md' if action == 'explain' else '.answer.' + EXTENSIONS[trial['language']])
    if action == 'explain':
        start = json.loads(base.with_suffix('.start.json').read_bytes())
        if start['registrySha256'] != sha(registry_raw) or start['protocolSha256'] != sha(protocol_raw):
            raise ValueError('Frozen manifest changed during this observation')
        write_once_bytes(raw_path, payload)
        seconds = (ended_mono - int(start['startedMonotonicNs'])) / 1e9
        failure = None
        try:
            observed_metrics = metrics(payload)
            if not payload.decode('utf-8').strip():
                failure = 'empty explanation'
        except UnicodeDecodeError:
            observed_metrics = {'utf8Bytes': len(payload), 'unicodeCharacters': None,
                                'charactersExcludingUnicodeWhiteSpace': None,
                                'whitespacePolicy': 'Unicode White_Space; fixed 25-code-point set; no normalization'}
            failure = 'invalid UTF-8 explanation'
        if seconds <= 0:
            failure = 'nonpositive monotonic interval'
        if start['observerBootId'] != boot_id():
            failure = 'observer boot changed'
        if len(payload) > 240000:
            failure = 'explanation exceeded fixed 240000-byte observation limit'
        result = {**start, 'endedMonotonicNs': str(ended_mono), 'endedUnixNs': str(ended_unix),
                  'explanationSha256': sha(payload), 'explanationPath': str(raw_path.relative_to(root)),
                  'rawExplanationMetrics': observed_metrics,
                  'timing': {'valid': failure is None, 'elapsedSeconds': seconds,
                             'boundary': 'OS samples before public prompt emission to complete raw explanation receipt; includes tool and transport latency, excludes subsequent code and grading',
                             'failure': failure}}
        write_once(base.with_suffix('.reasoning.json'), result)
        if emit:
            print('Exact explanation saved unchanged. Clock stopped. Submit its implementation in the presented language without revising the explanation.')
        return result
    if action != 'code':
        raise ValueError('Expected begin, explain or code')
    reasoning = json.loads(base.with_suffix('.reasoning.json').read_bytes())
    if reasoning['registrySha256'] != sha(registry_raw) or reasoning['protocolSha256'] != sha(protocol_raw):
        raise ValueError('Frozen manifest changed during this observation')
    write_once_bytes(raw_path, payload)
    failure = None
    try:
        if not payload.decode('utf-8').strip():
            failure = 'empty implementation'
    except UnicodeDecodeError:
        failure = 'invalid UTF-8 implementation'
    result = {**reasoning, 'sourcePath': str(raw_path.relative_to(root)), 'sourceSha256': sha(payload),
              'language': trial['language'], 'implementationEndedMonotonicNs': str(ended_mono),
              'implementationEndedUnixNs': str(ended_unix),
              'implementationSecondsExcludedFromExplanation': (ended_mono - int(reasoning['endedMonotonicNs'])) / 1e9,
              'implementationSubmissionFailure': failure}
    write_once(base.with_suffix('.submission.json'), result)
    if emit:
        print(json.dumps({'id': trial_id, 'saved': True, 'observationFailure': reasoning['timing']['failure'],
                          'implementationSubmissionFailure': failure}))
    return result


def self_test():
    original = '証明\r\nA\t😀 e\u0301\u0085\ufeff\x1c\n'.encode('utf-8')
    observed = metrics(original)
    assert observed['unicodeCharacters'] == len(original.decode('utf-8'))
    assert observed['utf8Bytes'] == len(original)
    assert metrics('\u0085\ufeff\x1c'.encode())['charactersExcludingUnicodeWhiteSpace'] == 2
    with tempfile.TemporaryDirectory(prefix='cti-raw-worker-') as name:
        root = Path(name)
        registry_path, protocol_path = root/'registry.json', root/'protocol.json'
        task = {'id': 'task_opaque', 'publicSpec': {'statement': 'Public only'},
                'cases': [{'SECRET': True}], 'referenceSource': 'DO NOT EMIT'}
        trial = {'id': 'trial_opaque', 'taskId': task['id'], 'language': 'cpp',
                 'requestedModel': 'test', 'requestedReasoningEffort': 'low', 'independentTrial': 1}
        registry = {'experimentId': 'self-test', 'publicInstructions': {'language': '日本語'},
                    'tasks': [task], 'trials': [trial]}
        protocol = {'experimentId': 'self-test', 'worker': {'sha256': sha(Path(__file__).read_bytes())}}
        registry_path.write_bytes(json_bytes(registry));protocol_path.write_bytes(json_bytes(protocol))
        options = dict(root=root, run=root/'run', registry_path=registry_path, protocol_path=protocol_path, emit=False)
        start = worker('begin', trial['id'], **options)
        prompt = (root/start['promptPath']).read_bytes()
        assert b'SECRET' not in prompt and b'DO NOT EMIT' not in prompt
        assert isinstance(start['startedMonotonicNs'], str)
        explained = worker('explain', trial['id'], payload=original, **options)
        assert (root/explained['explanationPath']).read_bytes() == original
        assert explained['explanationSha256'] == sha(original)
        assert explained['rawExplanationMetrics'] == observed
        result = worker('code', trial['id'], payload=b'bool answer(){return false;}\n', **options)
        assert result['timing']['valid'] is True
        for action in ['begin', 'explain', 'code']:
            try:
                worker(action, trial['id'], payload=original, **options)
            except FileExistsError:
                pass
            else:
                raise AssertionError('Immutable phase was overwritten')
    print('Raw observer self-test passed: exact bytes, Unicode counts, no hidden output, immutable phases and string nanoseconds.')


if __name__ == '__main__':
    if sys.argv[1:] == ['--self-test']:
        self_test()
    elif len(sys.argv) == 3 and sys.argv[1] in ('begin', 'explain', 'code'):
        worker(sys.argv[1], sys.argv[2])
    else:
        raise SystemExit('Usage: raw-explanation-worker.py begin|explain|code OPAQUE_TRIAL_ID; or --self-test')
