// Native textarea editing with a non-interactive syntax layer. Completion only
// uses the visible exercise/source and language vocabulary, never answer data.
import { renderHighlightedCode } from './codehighlight.js';

const mounted = new WeakMap();
let nextId = 0;
const vocabulary = {
  cpp: 'alignas auto bool break case catch char class const constexpr continue default delete double else enum explicit false float for if inline int long namespace new nullptr private protected public return short signed sizeof static std struct switch template this throw true try typedef typename unsigned using virtual void volatile while',
  csharp: 'abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event false finally float for foreach get if in int interface internal is lock long namespace new null object out override params private protected public readonly ref return sbyte sealed set short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked ushort using var virtual void volatile while yield',
  rust: 'as async await bool break char const continue crate dyn else enum extern f32 f64 false fn for i32 i64 if impl in let loop match mod move mut Option pub ref return self Self Some static str String struct super trait true type u32 u64 unsafe use usize Vec where while',
  go: 'append bool break byte cap case chan close complex const continue copy default defer delete else error fallthrough false float32 float64 for func go goto if import int int32 int64 interface len make map new nil package range return rune select string struct switch true type uint uint32 uint64 var',
  python: 'and as assert async await bool break class continue def del dict elif else enumerate except False finally float for from global if import in int is lambda len list None nonlocal not or pass print range raise return reversed set sorted str sum super True try tuple while with yield zip',
  java: 'abstract boolean break byte case catch char class const continue default do double else enum extends false final finally float for if implements import instanceof int interface long native new null package private protected public return short static strictfp String super switch synchronized this throw throws transient true try var void volatile while',
  sql: 'SELECT FROM WHERE AND OR NOT AS JOIN LEFT RIGHT INNER OUTER ON GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET DISTINCT UNION ALL WITH RECURSIVE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX DROP ALTER CASE WHEN THEN ELSE END NULL IS COALESCE COUNT SUM AVG MIN MAX OVER PARTITION ROW_NUMBER RANK LAG LEAD EXISTS IN BETWEEN LIKE CAST INTEGER TEXT REAL',
  lua: 'and assert break do else elseif end false for function if in ipairs local nil not or pairs print repeat return string table then tonumber tostring true type until while'
};

const aliases = { 'c++': 'cpp', 'c#': 'csharp', rs: 'rust', py: 'python' };
const textContext = value => typeof value === 'string' ? value : Array.isArray(value) ? value.filter(item => typeof item === 'string').join('\n') : '';
const identifierChar = value => /[A-Za-z0-9_$]/.test(value || '');
const styleProperties = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'fontVariantLigatures', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'textIndent', 'textTransform', 'tabSize', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'direction'];

function indent(editor, backwards) {
  const value = editor.value, start = editor.selectionStart, end = editor.selectionEnd;
  if (!backwards && start === end) {
    editor.setRangeText('    ', start, end, 'end');
    return true;
  }
  const lineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const rangeEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  let firstChange = 0, totalChange = 0;
  const replacement = value.slice(lineStart, rangeEnd).split('\n').map((line, index) => {
    const change = backwards ? -(line.startsWith('\t') ? 1 : line.match(/^ {1,4}/)?.[0].length || 0) : 4;
    if (!index) firstChange = change;
    totalChange += change;
    return backwards ? line.slice(-change) : `    ${line}`;
  }).join('\n');
  if (!totalChange) return false;
  const direction = editor.selectionDirection;
  editor.setRangeText(replacement, lineStart, rangeEnd, 'preserve');
  editor.setSelectionRange(Math.max(lineStart, start + firstChange), Math.max(lineStart, end + totalChange), direction);
  return true;
}

function prefixAt(editor) {
  if (editor.selectionStart !== editor.selectionEnd) return null;
  const caret = editor.selectionStart;
  const match = editor.value.slice(0, caret).match(/[A-Za-z_$][A-Za-z0-9_$]*$/);
  if (!match) return null;
  const start = caret - match[0].length;
  // Do not treat the suffix of an invalid numeric identifier as a word.
  if (start && identifierChar(editor.value[start - 1])) return null;
  let end = caret;
  while (identifierChar(editor.value[end])) end++;
  return { start, end, prefix: match[0], caret };
}

function commonPrefix(values, insensitive) {
  let prefix = values[0] || '';
  for (const value of values.slice(1)) {
    let index = 0;
    while (index < prefix.length && index < value.length && (insensitive ? prefix[index].toLowerCase() === value[index].toLowerCase() : prefix[index] === value[index])) index++;
    prefix = prefix.slice(0, index);
  }
  return prefix;
}

export function attachCodeEditor(editor, options = {}) {
  const existing = mounted.get(editor);
  if (existing) { existing.update(options); return existing; }
  const doc = editor.ownerDocument, view = doc.defaultView;
  const wrap = doc.createElement('div'); wrap.className = 'code-editor code-editor-wrap';
  const layer = doc.createElement('div'); layer.className = 'code-editor-highlight'; layer.setAttribute('aria-hidden', 'true');
  const code = doc.createElement('pre'); code.className = 'code-editor-code'; layer.append(code);
  const popup = doc.createElement('div'); popup.className = 'code-editor-completions'; popup.id = `code-completions-${++nextId}`; popup.hidden = true;
  popup.setAttribute('role', 'listbox'); popup.setAttribute('aria-label', 'コードの補完候補');
  const previousAttributes = new Map(['aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant'].map(name => [name, editor.getAttribute(name)]));
  editor.before(wrap); wrap.append(layer, editor, popup);
  editor.classList.add('code-editor-active');
  editor.setAttribute('aria-autocomplete', 'list'); editor.setAttribute('aria-expanded', 'false'); editor.setAttribute('aria-controls', popup.id);
  let language = 'cpp', context = '', enabled = true, pending = null, destroyed = false, rendering = false;
  const listeners = [];
  const listen = (target, type, callback, settings) => { target.addEventListener(type, callback, settings); listeners.push(() => target.removeEventListener(type, callback, settings)); };

  function syncScroll() {
    code.style.transform = `translate(${-editor.scrollLeft}px, ${-editor.scrollTop}px)`;
  }
  function syncLayout() {
    if (destroyed || !editor.isConnected) return;
    const style = view.getComputedStyle(editor);
    for (const property of styleProperties) code.style[property] = style[property];
    layer.style.left = `${editor.offsetLeft + (parseFloat(style.borderLeftWidth) || 0)}px`;
    layer.style.top = `${editor.offsetTop + (parseFloat(style.borderTopWidth) || 0)}px`;
    layer.style.width = `${editor.clientWidth}px`;
    layer.style.height = `${editor.clientHeight}px`;
    code.style.width = editor.wrap === 'off' ? 'max-content' : `${editor.clientWidth}px`;
    code.style.minWidth = `${editor.clientWidth}px`;
    code.style.whiteSpace = editor.wrap === 'off' ? 'pre' : 'pre-wrap';
    code.style.overflowWrap = editor.wrap === 'off' ? 'normal' : 'break-word';
    code.style.wordBreak = style.wordBreak;
    syncScroll();
  }
  function refresh() {
    if (destroyed || rendering) return;
    rendering = true;
    renderHighlightedCode(code, editor.value, language);
    // An empty final line has real height in a textarea. Keep it in the mirror.
    let end = code.querySelector('.code-editor-end');
    if (!end) { end = doc.createElement('span'); end.className = 'code-editor-end'; end.textContent = '\u200b'; code.append(end); }
    syncLayout();
    rendering = false;
  }
  function closePopup() {
    pending = null; popup.hidden = true; popup.replaceChildren();
    editor.setAttribute('aria-expanded', 'false'); editor.removeAttribute('aria-activedescendant');
  }
  function sendInput() {
    editor.dispatchEvent(new view.InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
  }
  function replaceWord(word, text) {
    if (editor.maxLength >= 0 && editor.value.length - (word.end - word.start) + text.length > editor.maxLength) return false;
    editor.setRangeText(text, word.start, word.end, 'end');
    refresh(); sendInput();
    return true;
  }
  function candidates(word) {
    const insensitive = language === 'sql';
    const key = value => insensitive ? value.toLowerCase() : value;
    const prefix = key(word.prefix);
    const visible = `${context}\n${editor.value}`.match(/[A-Za-z_$][A-Za-z0-9_$]{0,79}/g) || [];
    const unique = new Map();
    for (const candidate of [...visible, ...(vocabulary[language] || '').split(' ')]) {
      if (candidate.length <= word.prefix.length || !key(candidate).startsWith(prefix)) continue;
      if (!unique.has(key(candidate))) unique.set(key(candidate), candidate);
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'en')).slice(0, 30);
  }
  function caretRect() {
    const walker = doc.createTreeWalker(code, view.NodeFilter.SHOW_TEXT);
    let node, offset = editor.selectionStart;
    while ((node = walker.nextNode())) {
      if (offset <= node.length) {
        const range = doc.createRange(); range.setStart(node, offset); range.collapse(true);
        const rect = range.getBoundingClientRect();
        if (rect.height) return rect;
        // The zero-width final marker also gives the empty last line a rect.
        if (offset < node.length) { range.setEnd(node, offset + 1); return range.getBoundingClientRect(); }
      }
      offset -= node.length;
    }
    return editor.getBoundingClientRect();
  }
  function highlightOption() {
    if (!pending) return;
    for (const [index, option] of [...popup.children].entries()) option.setAttribute('aria-selected', String(index === pending.index));
    const selected = popup.children[pending.index];
    editor.setAttribute('aria-activedescendant', selected.id);
    selected.scrollIntoView({ block: 'nearest' });
  }
  function showPopup(word, choices) {
    pending = { word, choices, index: 0 };
    popup.replaceChildren(...choices.map((value, index) => {
      const option = doc.createElement('button'); option.type = 'button'; option.className = 'code-editor-completion';
      option.id = `${popup.id}-${index}`; option.tabIndex = -1; option.setAttribute('role', 'option'); option.textContent = value;
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => { const selected = pending?.word; closePopup(); if (selected) { editor.focus({ preventScroll: true }); replaceWord(selected, value); } });
      return option;
    }));
    popup.hidden = false; editor.setAttribute('aria-expanded', 'true');
    const rect = caretRect(), container = wrap.getBoundingClientRect();
    popup.style.left = `${Math.max(0, Math.min(rect.left - container.left, container.width - Math.min(280, container.width)))}px`;
    popup.style.top = `${Math.max(0, rect.bottom - container.top + 4)}px`;
    highlightOption();
  }
  function onKey(event) {
    if (!enabled || editor.disabled || editor.readOnly || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape' && pending) {
      event.preventDefault(); event.stopImmediatePropagation(); closePopup(); return;
    }
    if (pending && (event.key === 'ArrowDown' || event.key === 'ArrowUp') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); event.stopImmediatePropagation();
      pending.index = (pending.index + (event.key === 'ArrowDown' ? 1 : pending.choices.length - 1)) % pending.choices.length;
      highlightOption(); return;
    }
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) {
      // Enter keeps its native newline behavior; only Tab accepts completion.
      closePopup(); return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.shiftKey) { closePopup(); if (indent(editor, true)) { refresh(); sendInput(); } return; }
    const word = prefixAt(editor);
    if (pending && word && word.start === pending.word.start && word.caret === pending.word.caret && word.prefix === pending.word.prefix) {
      const value = pending.choices[pending.index]; closePopup(); replaceWord(word, value); return;
    }
    closePopup();
    const choices = word ? candidates(word) : [];
    if (choices.length === 1) { replaceWord(word, choices[0]); return; }
    if (choices.length > 1) {
      const shared = commonPrefix(choices, language === 'sql');
      if (shared.length > word.prefix.length && replaceWord(word, shared)) showPopup(prefixAt(editor), choices);
      else showPopup(word, choices);
      return;
    }
    if (indent(editor, false)) { refresh(); sendInput(); }
  }
  listen(editor, 'keydown', onKey, true);
  listen(editor, 'input', () => { closePopup(); refresh(); });
  listen(editor, 'scroll', () => { closePopup(); syncScroll(); });
  listen(editor, 'click', closePopup);
  listen(editor, 'blur', () => { view.setTimeout(() => { if (!wrap.contains(doc.activeElement)) closePopup(); }, 0); });
  listen(view, 'resize', syncLayout);
  const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(syncLayout) : null;
  observer?.observe(editor);
  const handle = {
    update(next = {}) {
      const nextLanguage = String(next.language ?? language).toLowerCase();
      const normalized = aliases[nextLanguage] || nextLanguage;
      const nextContext = next.context === undefined ? context : textContext(next.context);
      if (normalized !== language || nextContext !== context) closePopup();
      language = normalized; context = nextContext;
      enabled = Object.hasOwn(vocabulary, language);
      wrap.dataset.language = language;
      refresh();
    },
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true; observer?.disconnect(); for (const remove of listeners) remove();
      editor.classList.remove('code-editor-active');
      for (const [name, value] of previousAttributes) { if (value === null) editor.removeAttribute(name); else editor.setAttribute(name, value); }
      wrap.before(editor); wrap.remove(); mounted.delete(editor);
    }
  };
  mounted.set(editor, handle); handle.update(options);
  return handle;
}
