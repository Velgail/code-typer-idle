import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeCode, renderHighlightedCode } from '../src/codehighlight.js';

const samples = {
  cpp: '#include <vector>\nint main() { std::string message = "// keep <b>"; /* note */ return 0x2A; }',
  csharp: 'public string Name => @"C:\\games\\""draft"""; // 日本語\nvar value = $"{2 + 3}";',
  rust: "fn borrow<'a>(text: &'a str) -> char { /* outer /* inner */ tail */ let raw = r##\"// no comment\"##; 'x' }",
  go: 'package main\nfunc main() { raw := `/* text */`; count := 1_000; println(raw, count) }',
  python: 'def explain(name: str):\n    """Use # inside a docstring.\n    日本語も残す。"""\n    return f"Hello {name}" # comment',
  java: 'class Game { String text = """\n// text\n"""; int score = 7; }',
  sql: "SELECT 'it''s -- text', \"odd name\", [group] FROM players /* note */ WHERE score >= 10;",
  lua: 'local message = [=[-- literal ]] with extra ]=]\n--[==[ multiline\ncomment ]==]\nreturn message',
};

function textOf(source, language, type) {
  return tokenizeCode(source, language).filter(token => token.type === type).map(token => token.text).join('');
}

test('all eight language lexers preserve complete and partial source exactly', () => {
  for (const [language, source] of Object.entries(samples)) {
    for (let length = 0; length <= source.length; length++) {
      const partial = source.slice(0, length), tokens = tokenizeCode(partial, language);
      assert.equal(tokens.map(token => token.text).join(''), partial, `${language}/${length}`);
      assert.ok(tokens.every(token => token.text.length > 0), `${language}/${length}`);
    }
  }
  assert.deepEqual(tokenizeCode('<script>🙂\n日本語', 'unknown'), [{ type: 'plain', text: '<script>🙂\n日本語' }]);
  assert.deepEqual(tokenizeCode(null, 'cpp'), []);
});

test('strings and raw strings protect embedded comment delimiters', () => {
  const fixtures = [
    ['cpp', 'const char *text = "// /* text */"; // real', '// real'],
    ['cpp', 'auto text = R"tag(embedded " // /* raw)tag"; /* real */', '/* real */'],
    ['csharp', 'var text = @"A ""quote"" // text"; // real', '// real'],
    ['csharp', 'var text = """A "quote" // text"""; // real', '// real'],
    ['rust', 'let text = br###"" // /* raw"###; // real', '// real'],
    ['go', 'text := `" // /* raw`; // real', '// real'],
    ['python', 'text = r"""line # "text"\nmore""" # real', '# real'],
    ['java', 'String text = """\n// text\n"""; // real', '// real'],
    ['sql', "SELECT 'it''s -- text', \"/* name */\"; -- real", '-- real'],
    ['lua', 'local text = [==[-- text [[ ]=] still]==]; -- real', '-- real'],
  ];
  for (const [language, source, comment] of fixtures) {
    assert.equal(textOf(source, language, 'comment'), comment, language);
    assert.ok(textOf(source, language, 'string').length > 0, language);
  }
});

test('Rust nested comments, lifetimes and character literals stay distinct', () => {
  const source = "fn borrow<'a>(text: &'a str) -> &'static str { /* one /* two */ three */ let c = '\\n'; let q = 'x'; text }";
  assert.equal(textOf(source, 'rust', 'comment'), '/* one /* two */ three */');
  assert.equal(textOf(source, 'rust', 'string'), "'\\n''x'");
  assert.ok(textOf(source, 'rust', 'type').includes("'static"));
  assert.ok(textOf(source, 'rust', 'type').includes("'a"));
});

test('Lua long comments and long strings use matching equal-sign delimiters', () => {
  const source = '--[=[ outer ]] text ]=]\nlocal raw = [==[first ]=] next]==]\nreturn raw -- end';
  assert.equal(textOf(source, 'lua', 'comment'), '--[=[ outer ]] text ]=]-- end');
  assert.equal(textOf(source, 'lua', 'string'), '[==[first ]=] next]==]');
});

test('keywords, types, numeric literals and SQL quoted names are classified', () => {
  assert.equal(textOf('if (score >= 42) return 0xFF;', 'C++', 'keyword'), 'ifreturn');
  assert.equal(textOf('int score = 42; float rate = 1.25e-3;', 'cpp', 'type'), 'intfloat');
  assert.equal(textOf('int score = 42; float rate = 1.25e-3;', 'cpp', 'number'), '421.25e-3');
  assert.equal(textOf('select "from", [where], `join` from games', 'sql', 'keyword'), 'selectfrom');
  assert.equal(textOf('select "from", [where], `join` from games', 'sql', 'identifier'), '"from"[where]`join`games');
  assert.equal(textOf('return π + 2', 'python', 'identifier'), 'π');
  assert.equal(textOf('print(1)', 'lua', 'function'), 'print');
  assert.equal(textOf('let count = 42usize; let bits = 0xffu8;', 'rust', 'number'), '42usize0xffu8');
  assert.equal(textOf('// note\rreturn 2;', 'cpp', 'comment'), '// note');
});

// A DOM double deliberately has no HTML parser. Setting innerHTML is a failure.
class FakeNode {
  constructor(document, nodeType, text = '') { this.ownerDocument = document; this.nodeType = nodeType; this.children = []; this.text = text; this.replaceCount = 0; }
  get textContent() { return this.nodeType === 3 ? this.text : this.children.map(child => child.textContent).join(''); }
  set textContent(text) { this.children = [this.ownerDocument.createTextNode(text)]; }
  set innerHTML(_) { throw new Error('Untrusted source must not be parsed as HTML'); }
  appendChild(child) { if (child.nodeType === 11) this.children.push(...child.children); else this.children.push(child); return child; }
  replaceChildren(...children) { this.replaceCount++; this.children = []; for (const child of children) this.appendChild(child); }
}
function fakeElement() {
  const document = {
    createDocumentFragment() { return new FakeNode(document, 11); },
    createTextNode(text) { return new FakeNode(document, 3, text); },
    createElement(tag) { const element = new FakeNode(document, 1); element.tagName = tag; return element; },
  };
  return document.createElement('code');
}

test('DOM rendering preserves hostile markup as text and caches unchanged content', () => {
  const element = fakeElement();
  const source = 'return "</span><img src=x onerror=alert(1)>"; // <script>\n';
  assert.equal(renderHighlightedCode(element, source, 'cpp'), true);
  assert.equal(element.textContent, source);
  assert.ok(element.children.some(child => child.className === 'ct-syntax-keyword'));
  assert.ok(element.children.every(child => child.nodeType !== 1 || child.tagName === 'span'));
  const children = element.children;
  assert.equal(renderHighlightedCode(element, source, 'cpp'), false);
  assert.equal(element.children, children);
  assert.equal(element.replaceCount, 1);
  assert.equal(renderHighlightedCode(element, source, 'python'), true);
  assert.equal(element.replaceCount, 2);
  assert.equal(renderHighlightedCode(element, '', 'python'), true);
  assert.equal(element.textContent, '');
});
