import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {challengeTopics} from '../src/challengecatalog.js';

function harnessFor(language, arrays, source) {
  const question = challengeTopics(language, 'syntax').find(q => q.topicId === 'sum-sequence');
  const original = question.cases, originalResultType = question.resultType;
  question.resultType = 'array';
  question.cases = arrays.map((values, i) => ({id:`large-${i}`, args:[values], expected:fingerprint(values)}));
  try { return question.createHarness(source); }
  finally { question.cases = original; question.resultType = originalResultType; }
}
const indexes = [0, 1, 255, 256, 257, 665, 666, 7998, 7999, 8000, 16383, 49999];
function fingerprint(values) {
  let hash = 0;
  for (const value of values) hash = (hash + value % 1000003 + 1000003) % 1000003;
  return [values.length, hash, ...indexes.map(index => values[index] ?? 0)];
}
const fixtures = [[], [0], Array(256).fill(-3), Array(257).fill(7),
  Array.from({length:1800}, (_, i) => i % 2 ? -2147483648 : 2147483647),
  Array.from({length:50000}, (_, i) => i % 8191 === 0 ? -2147483648 : i % 8191 === 1 ? 2147483647 : i % 2 ? -i : i)];
const javaSource = `static java.util.ArrayList<Integer> sum_sequence(java.util.ArrayList<Integer> values) {
  int hash = 0;
  for (int value : values) hash = (hash + value % 1000003 + 1000003) % 1000003;
  java.util.ArrayList<Integer> out = new java.util.ArrayList<Integer>();
  out.add(values.size()); out.add(hash);
  for (int index : new int[]{${indexes.join(',')}}) out.add(index < values.size() ? values.get(index) : 0);
  return out;
}`;
const csharpSource = `static System.Collections.Generic.List<int> sum_sequence(System.Collections.Generic.List<int> values) {
  int hash = 0;
  foreach (int value in values) hash = (hash + value % 1000003 + 1000003) % 1000003;
  var output = new System.Collections.Generic.List<int>();
  output.Add(values.Count); output.Add(hash);
  foreach (int index in new int[]{${indexes.join(',')}}) output.Add(index < values.Count ? values[index] : 0);
  return output;
}`;
const rustSource = `fn sum_sequence(values: Vec<i32>) -> Vec<i32> {
  let mut hash = 0;
  for value in &values { hash = (hash + value % 1000003 + 1000003) % 1000003; }
  let mut out = vec![values.len() as i32, hash];
  for index in [${indexes.join(',')}] { out.push(if index < values.len() { values[index] } else { 0 }); }
  out
}`;

const goSource = `func sum_sequence(values []int) []int {
  hash := 0
  for _, value := range values { hash = (hash + value % 1000003 + 1000003) % 1000003 }
  output := []int{len(values), hash}
  for _, index := range []int{${indexes.join(',')}} {
    if index < len(values) { output = append(output, values[index]) } else { output = append(output, 0) }
  }
  return output
}`;

test('large Java, C#, Rust and Go fixtures use bounded complete-token strings while small fixtures keep their source form', () => {
  for (const [language, source] of [['java', javaSource], ['csharp', csharpSource], ['rust', rustSource], ['go', goSource]]) {
    const small = harnessFor(language, fixtures.slice(0, 3), source);
    assert.ok(!/ctiHarnessIntArray|cti_harness_int_array/.test(small.source));
    const large = harnessFor(language, fixtures, source);
    assert.match(large.source, language==='rust'?/cti_harness_int_array\(&\[/ : language==='go'?/ctiHarnessIntArray\(\[\]string\{/ : /ctiHarnessIntArray\(new (?:String|string)\[\]/);
    const encoded = [...large.source.matchAll(/"(-?\d+,)+"/g)].map(match => JSON.parse(match[0]));
    assert.ok(encoded.length > 2);
    for (const part of encoded) {
      assert.ok(part.length <= 8000);
      assert.match(part, /^(?:-?\d+,)+$/);
    }
    const decoded = encoded.flatMap(part => part.slice(0, -1).split(',').map(Number));
    assert.deepEqual(decoded, fixtures.filter(values => values.length > 256).flat());
    assert.deepEqual(large.expected, fixtures.map(fingerprint));
  }
});

const rustCompiler = spawnSync('rustc', ['--version'], {encoding:'utf8', timeout:10000});
test('native Rust compiles and reconstructs large fixtures without a giant vector macro', {skip:rustCompiler.status !== 0}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cti-large-rust-'));
  try {
    const harness = harnessFor('rust', fixtures, rustSource), path = join(dir, 'main.rs'), output = join(dir, 'main');
    writeFileSync(path, harness.source);
    const compiled = spawnSync('rustc', [path, '-o', output], {encoding:'utf8', timeout:30000});
    assert.equal(compiled.status, 0, compiled.stderr || String(compiled.error));
    const executed = spawnSync(output, [], {encoding:'utf8', timeout:30000});
    assert.equal(executed.status, 0, executed.stderr || String(executed.error));
    assert.deepEqual(executed.stdout.trim().split('\n').map(line => JSON.parse(line)), harness.expected);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

const javaCompiler = spawnSync('java', ['com.sun.tools.javac.Main', '-version'], {encoding:'utf8', timeout:10000});
test('native Java compiles and reconstructs large fixtures across token, string and method limits', {skip:javaCompiler.status !== 0}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cti-large-java-'));
  try {
    const harness = harnessFor('java', fixtures, javaSource), path = join(dir, 'Main.java');
    writeFileSync(path, harness.source);
    const compiled = spawnSync('java', ['com.sun.tools.javac.Main', path], {encoding:'utf8', timeout:30000});
    assert.equal(compiled.status, 0, compiled.stderr || String(compiled.error));
    const executed = spawnSync('java', ['-cp', dir, 'Main'], {encoding:'utf8', timeout:30000});
    assert.equal(executed.status, 0, executed.stderr || String(executed.error));
    assert.deepEqual(executed.stdout.trim().split('\n').map(line => JSON.parse(line)), harness.expected);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

const monoCompiler = spawnSync('mcs', ['--version'], {encoding:'utf8', timeout:10000});
test('native C# compiles and reconstructs large fixtures when Mono is installed', {skip:monoCompiler.status !== 0}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cti-large-csharp-'));
  try {
    const harness = harnessFor('csharp', fixtures, csharpSource), path = join(dir, 'Program.cs'), output = join(dir, 'Program.exe');
    writeFileSync(path, harness.source);
    const compiled = spawnSync('mcs', ['-out:'+output, path], {encoding:'utf8', timeout:30000});
    assert.equal(compiled.status, 0, compiled.stderr || String(compiled.error));
    const executed = spawnSync('mono', [output], {encoding:'utf8', timeout:30000});
    assert.equal(executed.status, 0, executed.stderr || String(executed.error));
    assert.deepEqual(executed.stdout.trim().split('\n').map(line => JSON.parse(line)), harness.expected);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});


const goCompiler = spawnSync('go', ['version'], {encoding:'utf8', timeout:10000});
test('native Go reconstructs large fixtures without deeply nested array literals', {skip:goCompiler.status !== 0}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cti-large-go-'));
  try {
    const harness = harnessFor('go', fixtures, goSource), path = join(dir, 'main.go'), output = join(dir, 'main');
    writeFileSync(path, harness.source);
    const compiled = spawnSync('go', ['build', '-o', output, path], {encoding:'utf8', timeout:30000});
    assert.equal(compiled.status, 0, compiled.stderr || String(compiled.error));
    const executed = spawnSync(output, [], {encoding:'utf8', timeout:30000});
    assert.equal(executed.status, 0, executed.stderr || String(executed.error));
    assert.deepEqual(executed.stdout.trim().split('\n').map(line => JSON.parse(line)), harness.expected);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
