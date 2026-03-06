import { parseFragment, serialize } from 'parse5';

export function normalizeHtml(html) {
  const serialized = serialize(parseFragment(html));
  return serialized
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}
