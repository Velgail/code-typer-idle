import { tokenizeCode } from './codehighlight.js';

const rendered = new WeakMap();

// Keep the progress, caret, and translated-comment elements intact. Tokenize
// the complete displayed program so a caret inside a string/comment does not
// make its remaining characters appear to be a different language construct.
export function highlightTypingCode(pre, language) {
  if (!pre) return false;
  const source = pre.textContent;
  const previous = rendered.get(pre);
  if (previous?.source === source && previous.language === language) return false;
  for (const token of pre.querySelectorAll('[data-typing-token]')) {
    token.replaceWith(...token.childNodes);
  }

  const document = pre.ownerDocument;
  const walker = document.createTreeWalker(pre, 4); // SHOW_TEXT
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  const tokens = tokenizeCode(source, language);
  let tokenIndex = 0, tokenOffset = 0;
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let nodeOffset = 0;
    while (nodeOffset < node.data.length) {
      const token = tokens[tokenIndex];
      const length = Math.min(node.data.length - nodeOffset, token.text.length - tokenOffset);
      const text = node.data.slice(nodeOffset, nodeOffset + length);
      if (token.type === 'plain') fragment.appendChild(document.createTextNode(text));
      else {
        const span = document.createElement('span');
        span.className = `ct-syntax-${token.type}`;
        span.dataset.typingToken = '';
        span.textContent = text;
        fragment.appendChild(span);
      }
      nodeOffset += length;
      tokenOffset += length;
      if (tokenOffset === token.text.length) { tokenIndex++; tokenOffset = 0; }
    }
    node.replaceWith(fragment);
  }
  rendered.set(pre, { source, language });
  return true;
}
