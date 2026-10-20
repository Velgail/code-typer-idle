import assert from 'node:assert/strict';

// Exercise the real shared editor independently of quiz rewards/runtime costs.
// The integrated Quiz and Challenge suites also cover their draft callbacks.
export async function runCodeEditorChecks(browser, url, errors) {
  const context = await browser.newContext({ viewport: { width: 900, height: 850 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url); await page.waitForSelector('.buy-button');
    await page.evaluate(async () => {
      const release = await (await fetch(new URL('version.json', location.href))).json();
      const { attachCodeEditor } = await import(new URL(`build/codeeditor.${release.id}.js`, location.href));
      const fixture = document.createElement('section'); fixture.id = 'code-editor-fixture'; fixture.style.cssText = 'position:relative;margin:20px;width:calc(100% - 40px);max-width:650px;';
      const editor = document.createElement('textarea'); editor.id = 'code-editor-test'; editor.className = 'quiz-source'; editor.wrap = 'off'; editor.rows = 4;
      editor.style.cssText = 'min-height:120px;height:120px;max-height:400px;'; editor.setAttribute('aria-label', 'Editor regression fixture');
      fixture.append(editor); document.body.prepend(fixture);
      const state = { editor, fixture, inputs: 0, handle: null, laterTabs: 0 };
      state.handle = attachCodeEditor(editor, { language: 'cpp', context: 'int total; int tally; int player; int planet;' });
      editor.addEventListener('input', () => state.inputs++);
      editor.addEventListener('keydown', event => { if (event.key === 'Tab') state.laterTabs++; });
      window.__codeEditorChecks = state;
    });
    const editor = page.locator('#code-editor-test');
    const source = 'int total = 7; // <img src=x onerror="globalThis.editorInjected=true">\n\n';
    await editor.fill(source);
    const highlighted = await page.evaluate(() => {
      const { editor, fixture } = window.__codeEditorChecks;
      const code = fixture.querySelector('.code-editor-code');
      const layer = fixture.querySelector('.code-editor-highlight');
      return { text: code.textContent, spans: code.querySelectorAll('[class^="ct-syntax-"]').length, images: fixture.querySelectorAll('img').length, injected: !!globalThis.editorInjected, aria: layer.getAttribute('aria-hidden'), color: getComputedStyle(editor).color, fill: getComputedStyle(editor).webkitTextFillColor };
    });
    assert.equal(highlighted.text, `${source}\u200b`, 'highlighting preserves all source characters and the empty trailing line');
    assert.ok(highlighted.spans > 0, 'the textarea has real syntax tokens behind it');
    assert.equal(highlighted.images, 0); assert.equal(highlighted.injected, false, 'submitted markup never becomes HTML');
    assert.equal(highlighted.aria, 'true', 'the non-editable mirror is hidden from assistive readers');
    assert.equal(highlighted.fill, 'rgba(0, 0, 0, 0)', 'native text is transparent so glyphs are not painted twice');

    await editor.fill('tota'); await editor.press('End'); await editor.press('Tab');
    assert.equal(await editor.inputValue(), 'total', 'Tab completes a unique visible identifier');
    assert.equal(await editor.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(await editor.evaluate(el => [el.selectionStart, el.selectionEnd]), [5, 5], 'completion leaves the caret after the inserted identifier');
    await editor.fill('pl'); await editor.press('End'); await editor.press('Tab');
    assert.equal(await editor.inputValue(), 'pla', 'an ambiguous completion inserts only the common prefix');
    assert.equal(await editor.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('#code-editor-fixture [role=option]').count(), 2);
    await editor.press('ArrowDown'); await editor.press('Tab');
    assert.equal(await editor.inputValue(), 'player', 'arrows select a candidate and only Tab accepts it');
    assert.equal(await editor.getAttribute('aria-expanded'), 'false');

    await editor.fill('pl'); await editor.press('End'); await editor.press('Tab'); await editor.press('Enter');
    assert.equal(await editor.inputValue(), 'pla\n', 'Enter remains a native newline while a completion popup is open');
    assert.equal(await editor.getAttribute('aria-expanded'), 'false');
    await editor.fill('pl'); await editor.press('End'); await editor.press('Tab'); await editor.press('Escape');
    assert.equal(await editor.inputValue(), 'pla'); assert.equal(await editor.getAttribute('aria-expanded'), 'false', 'Escape dismisses completion without editing');

    await editor.fill(''); await editor.press('Tab');
    assert.equal(await editor.inputValue(), '    ', 'Tab at a line start inserts four spaces');
    await editor.press('Shift+Tab'); assert.equal(await editor.inputValue(), '', 'Shift+Tab removes indentation');
    await editor.fill('one\ntwo\nthree'); await editor.evaluate(el => el.setSelectionRange(0, 8)); await editor.press('Tab');
    assert.equal(await editor.inputValue(), '    one\n    two\nthree', 'selected complete lines are indented without touching the next line');
    assert.deepEqual(await editor.evaluate(el => [el.selectionStart, el.selectionEnd]), [4, 16]);
    await editor.press('Shift+Tab'); assert.equal(await editor.inputValue(), 'one\ntwo\nthree');
    assert.deepEqual(await editor.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 8]);

    await editor.fill('int total;\nto'); await editor.press('End');
    await editor.evaluate(el => el.setSelectionRange(el.value.length - 2, el.value.length)); await editor.press('Tab');
    assert.equal(await editor.inputValue(), 'int total;\n    to', 'a selection requests indentation rather than guessing an identifier');
    assert.equal(await page.evaluate(() => window.__codeEditorChecks.laterTabs), 0, 'legacy bubbling Tab handlers cannot insert a second indentation');
    assert.ok(await page.evaluate(() => window.__codeEditorChecks.inputs > 5), 'completion and indentation dispatch normal draft input events');

    await page.evaluate(() => {
      const { editor, handle } = window.__codeEditorChecks;
      editor.value = 'SELECT amount FROM scores;\n'; handle.update({ language: 'sql', context: 'SELECT amount FROM scores;' });
    });
    assert.equal(await page.locator('#code-editor-fixture .code-editor-code').textContent(), 'SELECT amount FROM scores;\n\u200b', 'programmatic draft/language changes refresh the persistent mirror');
    await editor.fill('sel'); await editor.press('End'); await editor.press('Tab');
    assert.equal((await editor.inputValue()).toUpperCase(), 'SELECT', 'SQL completion ignores keyword case');

    for (const width of [900, 360]) {
      await page.setViewportSize({ width, height: 850 });
      const text = Array.from({ length: 60 }, (_, i) => `int line_${i} = ${i}; ${'long_identifier '.repeat(40)}`).join('\n') + '\n';
      await editor.fill(text);
      await editor.evaluate(el => { el.scrollTop = 500; el.scrollLeft = 300; el.dispatchEvent(new Event('scroll')); });
      const geometry = await page.evaluate(() => {
        const { editor, fixture } = window.__codeEditorChecks;
        const code = fixture.querySelector('.code-editor-code'), layer = fixture.querySelector('.code-editor-highlight');
        const actual = getComputedStyle(editor), mirror = getComputedStyle(code), box = editor.getBoundingClientRect();
        return { left: editor.scrollLeft, top: editor.scrollTop, transform: code.style.transform, width: layer.clientWidth, height: layer.clientHeight, inputWidth: editor.clientWidth, inputHeight: editor.clientHeight, font: actual.font, mirrorFont: mirror.font, padding: actual.padding, mirrorPadding: mirror.padding, box: { x: box.x, right: box.right }, viewport: innerWidth };
      });
      assert.equal(geometry.transform, `translate(${-geometry.left}px, ${-geometry.top}px)`, `${width}px scrolling keeps the highlight synchronized in both directions`);
      assert.equal(geometry.width, geometry.inputWidth); assert.equal(geometry.height, geometry.inputHeight);
      assert.equal(geometry.font, geometry.mirrorFont); assert.equal(geometry.padding, geometry.mirrorPadding);
      assert.ok(geometry.box.x >= 0 && geometry.box.right <= geometry.viewport + 1, `${width}px editor stays inside the viewport`);
    }

    await page.evaluate(() => {
      const { editor, handle } = window.__codeEditorChecks;
      editor.wrap = 'soft'; editor.value = 'int wrapping_variable = 1; '.repeat(35) + '\n'; handle.update({ language: 'cpp', context: '' });
    });
    const wrapping = await page.evaluate(() => {
      const { editor, fixture } = window.__codeEditorChecks;
      const code = fixture.querySelector('.code-editor-code');
      return { codeWidth: code.getBoundingClientRect().width, editorWidth: editor.clientWidth, whiteSpace: getComputedStyle(code).whiteSpace, text: code.textContent, value: editor.value };
    });
    assert.equal(wrapping.codeWidth, wrapping.editorWidth); assert.equal(wrapping.whiteSpace, 'pre-wrap'); assert.equal(wrapping.text, `${wrapping.value}\u200b`);
    await page.evaluate(() => window.__codeEditorChecks.handle.update({language:'cpp',context:'int player; int planet;'}));
    await editor.fill('pl');
    // The scroll/wrap fixture intentionally leaves scrollTop=500. Replacing it
    // with two characters queues native scroll events that dismiss completion.
    // Drain those layout/scroll deliveries before testing the readonly change.
    await editor.evaluate(async el=>{
      el.scrollTop=0;el.scrollLeft=0;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    });
    assert.deepEqual(await editor.evaluate(el=>[el.scrollTop,el.scrollLeft]),[0,0]);
    await editor.press('End');await editor.press('Tab');
    assert.equal(await editor.getAttribute('aria-expanded'),'true');
    await editor.evaluate(el=>{el.readOnly=true;window.__codeEditorChecks.handle.refresh();});
    assert.equal(await editor.getAttribute('aria-expanded'),'false','locking an editor closes any outstanding completion candidates');
    const readOnlyDraft=await editor.inputValue();await editor.press('Tab');
    assert.equal(await editor.inputValue(),readOnlyDraft,'completion cannot change a read-only textarea');
    await page.evaluate(() => window.__codeEditorChecks.handle.destroy());
    assert.equal(await page.locator('#code-editor-fixture .code-editor-wrap').count(), 0);
    assert.equal(await editor.getAttribute('aria-autocomplete'), null, 'destroy restores the native textarea attributes');
    assert.ok(!(await editor.getAttribute('class')).includes('code-editor-active'));
  } finally { await context.close(); }
}
