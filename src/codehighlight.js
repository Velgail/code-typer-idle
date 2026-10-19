// Small display-only lexer. This does not parse, execute, or grade submitted code.
const words = value => new Set(value.split(/\s+/).filter(Boolean));
const common = 'if else for while do break continue return switch case default try catch finally throw new class public private protected static const enum';
const keywords = {
  cpp: words(`${common} alignas alignof asm auto co_await co_return co_yield concept constexpr consteval constinit decltype delete dynamic_cast explicit export extern friend goto inline mutable namespace noexcept nullptr operator override register reinterpret_cast requires sizeof static_assert static_cast struct template this thread_local true false typedef typeid typename union using virtual volatile`),
  csharp: words(`${common} abstract as async await base checked delegate event explicit extern false fixed foreach get global implicit in init interface internal is lock namespace null object operator out override params partial readonly record ref required sealed set sizeof stackalloc struct this true typeof unchecked unsafe using value var virtual void volatile when where with yield`),
  rust: words('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while union'),
  go: words('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota'),
  python: words('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield match case type'),
  java: words(`${common} abstract assert boolean byte char double final float implements import instanceof int interface long native null package permits record sealed short strictfp super synchronized this throws transient true false var void volatile yield`),
  sql: words('ADD ALL ALTER AND AS ASC BEGIN BETWEEN BY CASE CAST CHECK COLLATE COMMIT CONFLICT CONSTRAINT CREATE CROSS CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATABASE DEFAULT DELETE DESC DISTINCT DO DROP ELSE END ESCAPE EXCEPT EXISTS EXPLAIN FALSE FILTER FIRST FOLLOWING FOREIGN FROM FULL GROUP HAVING IF IGNORE IN INDEX INNER INSERT INTERSECT INTO IS JOIN KEY LAST LEFT LIKE LIMIT MATCH NATURAL NOT NULL NULLS OFFSET ON OR ORDER OUTER OVER PARTITION PRAGMA PRECEDING PRIMARY RANGE RECURSIVE REFERENCES REPLACE RETURNING RIGHT ROLLBACK ROW ROWS SELECT SET TABLE THEN TRANSACTION TRIGGER TRUE UNION UNIQUE UPDATE USING VACUUM VALUES VIEW WHEN WHERE WINDOW WITH WITHOUT'),
  lua: words('and break do else elseif end false for function goto if in local nil not or repeat return then true until while'),
};
const types = {
  cpp: words('bool char char8_t char16_t char32_t double float int long short signed unsigned void wchar_t size_t ptrdiff_t string string_view vector array map unordered_map set unordered_set deque queue stack pair tuple optional unique_ptr shared_ptr span'),
  csharp: words('bool byte sbyte char decimal double float int uint long ulong short ushort string object dynamic Task ValueTask List Dictionary HashSet Queue Stack Span IEnumerable IDisposable DateTime Console Math'),
  rust: words('bool char str String usize isize u8 u16 u32 u64 u128 i8 i16 i32 i64 i128 f32 f64 Vec Option Result Some None Ok Err Box HashMap HashSet BTreeMap BTreeSet Iterator'),
  go: words('bool byte rune string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 complex64 complex128 error any comparable'),
  python: words('bool bytes bytearray complex dict float frozenset int list object range set str tuple type Exception ValueError TypeError NoneType'),
  java: words('Boolean Byte Character Double Float Integer Long Short String Object System Math List ArrayList Map HashMap Set HashSet Queue Deque Optional Stream'),
  sql: words('INTEGER INT REAL TEXT BLOB NUMERIC BOOLEAN VARCHAR CHAR DECIMAL DATE DATETIME JSON'),
  lua: words('string table math coroutine utf8 io os debug package'),
};
const aliases = { 'c++': 'cpp', 'c#': 'csharp', cs: 'csharp', py: 'python', golang: 'go', rs: 'rust' };
const identifier = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const number = /(?:0[xX][\da-fA-F](?:[\da-fA-F_']|\.(?=[\da-fA-F]))*(?:[pP][+-]?[\d_]+)?|0[bB][01][01_']*|0[oO][0-7][0-7_]*|(?:\d[\d_']*(?:\.(?!\.)[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?[\d_]+)?)(?:i(?:128|16|32|64|8|size)|u(?:128|16|32|64|8|size)|f(?:32|64)|[uUlLfFdDmMnN])*/y;
const whitespace = /\s+/y;
const cache = new WeakMap();

function quotedEnd(source, start, delimiter, { doubled = false, escaped = true } = {}) {
  let cursor = start + delimiter.length;
  while (cursor < source.length) {
    if (escaped && source[cursor] === '\\') { cursor += 2; continue; }
    if (source.startsWith(delimiter, cursor)) {
      if (doubled && source.startsWith(delimiter, cursor + delimiter.length)) { cursor += delimiter.length * 2; continue; }
      return cursor + delimiter.length;
    }
    cursor++;
  }
  return source.length;
}

function blockEnd(source, start, nested = false) {
  let cursor = start + 2, depth = 1;
  while (cursor < source.length) {
    if (nested && source.startsWith('/*', cursor)) { depth++; cursor += 2; }
    else if (source.startsWith('*/', cursor)) { cursor += 2; if (!--depth) return cursor; }
    else cursor++;
  }
  return source.length;
}

function luaLong(source, start) {
  const match = /^\[(=*)\[/.exec(source.slice(start));
  if (!match) return null;
  const close = `]${match[1]}]`, end = source.indexOf(close, start + match[0].length);
  return end < 0 ? source.length : end + close.length;
}

/** Tokenize incomplete or complete source without changing a single character. */
export function tokenizeCode(input, requestedLanguage) {
  const source = String(input ?? '');
  const requested = String(requestedLanguage ?? '').toLowerCase();
  const language = aliases[requested] || requested;
  if (!keywords[language]) return source ? [{ type: 'plain', text: source }] : [];
  const tokens = [];
  function push(type, start, end) {
    const text = source.slice(start, end), last = tokens[tokens.length - 1];
    if (last?.type === type) last.text += text;
    else tokens.push({ type, text });
  }
  let cursor = 0;
  while (cursor < source.length) {
    const start = cursor, char = source[cursor], tail = source.slice(cursor);
    let end;
    whitespace.lastIndex = cursor;
    const space = whitespace.exec(source);
    if (space) { cursor = whitespace.lastIndex; push('plain', start, cursor); continue; }
    const lineComment = (language === 'python' && char === '#') || ((language === 'sql' || language === 'lua') && tail.startsWith('--')) || (!['python', 'sql', 'lua'].includes(language) && tail.startsWith('//'));
    if (lineComment) {
      end = language === 'lua' ? luaLong(source, cursor + 2) : null;
      if (end == null) { const newline = /[\r\n]/.exec(tail); end = newline ? cursor + newline.index : source.length; }
      cursor = end; push('comment', start, cursor); continue;
    }
    if (!['python', 'lua'].includes(language) && tail.startsWith('/*')) {
      cursor = blockEnd(source, cursor, language === 'rust'); push('comment', start, cursor); continue;
    }
    if (language === 'lua' && (end = luaLong(source, cursor)) != null) {
      cursor = end; push('string', start, cursor); continue;
    }
    if (language === 'rust') {
      const raw = /^(?:br|cr|r)(#{0,255})"/.exec(tail);
      if (raw) {
        const close = `"${raw[1]}`, closeAt = source.indexOf(close, cursor + raw[0].length);
        cursor = closeAt < 0 ? source.length : closeAt + close.length; push('string', start, cursor); continue;
      }
      const lifetime = /^'[\p{L}_][\p{L}\p{N}_]*/u.exec(tail);
      if (lifetime && source[cursor + lifetime[0].length] !== "'") {
        cursor += lifetime[0].length; push('type', start, cursor); continue;
      }
    }
    if (language === 'cpp') {
      const raw = /^(?:u8|u|U|L)?R"([^ ()\\\t\r\n]{0,16})\(/.exec(tail);
      if (raw) {
        const close = `)${raw[1]}"`, closeAt = source.indexOf(close, cursor + raw[0].length);
        cursor = closeAt < 0 ? source.length : closeAt + close.length; push('string', start, cursor); continue;
      }
    }
    if (language === 'python') {
      const string = /^(?:[rRuUbBfF]{1,2})?("""|'''|"|')/.exec(tail);
      if (string) {
        cursor = quotedEnd(source, cursor + string[0].length - string[1].length, string[1]); push('string', start, cursor); continue;
      }
    }
    if (language === 'csharp') {
      const raw = /^\$*("{3,})/.exec(tail);
      if (raw) {
        const closeAt = source.indexOf(raw[1], cursor + raw[0].length);
        cursor = closeAt < 0 ? source.length : closeAt + raw[1].length; push('string', start, cursor); continue;
      }
      const string = /^(?:\$@|@\$|@|\$)?"/.exec(tail);
      if (string) {
        cursor = quotedEnd(source, cursor + string[0].length - 1, '"', { doubled: string[0].includes('@'), escaped: !string[0].includes('@') }); push('string', start, cursor); continue;
      }
    }
    if (language === 'java' && tail.startsWith('"""')) {
      cursor = quotedEnd(source, cursor, '"""'); push('string', start, cursor); continue;
    }
    if (char === '"' || char === "'" || (char === '`' && ['go', 'sql'].includes(language))) {
      const sql = language === 'sql';
      cursor = quotedEnd(source, cursor, char, { doubled: sql, escaped: !sql && !(language === 'go' && char === '`') });
      push(sql && char !== "'" ? 'identifier' : 'string', start, cursor); continue;
    }
    if (language === 'sql' && char === '[') {
      const close = source.indexOf(']', cursor + 1); cursor = close < 0 ? source.length : close + 1;
      push('identifier', start, cursor); continue;
    }
    number.lastIndex = cursor;
    const numeric = number.exec(source);
    if (numeric) { cursor = number.lastIndex; push('number', start, cursor); continue; }
    identifier.lastIndex = cursor;
    const name = identifier.exec(source);
    if (name) {
      cursor = identifier.lastIndex;
      const key = language === 'sql' ? name[0].toUpperCase() : name[0];
      const type = types[language].has(key) ? 'type' : keywords[language].has(key) ? 'keyword' : /^\s*\(/.test(source.slice(cursor)) ? 'function' : 'identifier';
      push(type, start, cursor); continue;
    }
    cursor++;
    push(/[+\-*/%=!<>|&^~?:.,;()[\]{}#@]/.test(char) ? 'operator' : 'plain', start, cursor);
  }
  return tokens;
}

/** Render with text nodes only; untrusted answers must never become HTML. */
export function renderHighlightedCode(element, input, language) {
  const source = String(input ?? ''), normalizedLanguage = String(language ?? '').toLowerCase();
  const previous = cache.get(element);
  if (previous?.source === source && previous.language === normalizedLanguage) return false;
  const document = element.ownerDocument;
  const fragment = document.createDocumentFragment();
  for (const token of tokenizeCode(source, normalizedLanguage)) {
    if (token.type === 'plain') fragment.appendChild(document.createTextNode(token.text));
    else {
      const span = document.createElement('span');
      span.className = `ct-syntax-${token.type}`;
      span.textContent = token.text;
      fragment.appendChild(span);
    }
  }
  element.replaceChildren(fragment);
  cache.set(element, { source, language: normalizedLanguage });
  return true;
}
