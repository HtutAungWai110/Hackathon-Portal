/**
 * The event description is plain text, not HTML. Authors already write it in
 * the textarea the way they would in a note: a blank line starts a new
 * paragraph, a line beginning with `-` or `*` is a bullet, and a line beginning
 * with `1.` is a numbered step. This turns that text into blocks a renderer can
 * hand to real `ul` and `ol` elements, so the page never injects markup.
 */

export type ListKind = 'bullets' | 'steps';

export type DescriptionBlock =
  | { type: 'paragraph'; text: string }
  | { type: ListKind; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const STEP = /^\s*\d+[.)]\s+(.*)$/;
const ANY_MARKER = /^\s*(?:[-*•]\s+|\d+[.)]\s+)/;
const BULLET_MARKER = /^\s*[-*•]\s+/;
const STEP_MARKER = /^\s*\d+[.)]\s+/;

function normalise(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

/**
 * Groups the lines into paragraphs and lists. A single newline stays inside its
 * paragraph, so text an author wrapped by hand still reads as they wrote it.
 */
export function descriptionBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: ListKind; items: string[] } | null = null;

  function flushParagraph(): void {
    if (paragraph.length === 0) {
      return;
    }
    const joined = paragraph.join('\n').trim();
    if (joined.length > 0) {
      blocks.push({ type: 'paragraph', text: joined });
    }
    paragraph = [];
  }

  function flushList(): void {
    if (list === null) {
      return;
    }
    if (list.items.length > 0) {
      blocks.push({ type: list.type, items: list.items });
    }
    list = null;
  }

  function startList(type: ListKind): string[] {
    flushParagraph();
    if (list?.type !== type) {
      flushList();
      list = { type, items: [] };
    }
    return list.items;
  }

  for (const line of normalise(text)) {
    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet?.[1] !== undefined) {
      startList('bullets').push(bullet[1].trim());
      continue;
    }

    const step = STEP.exec(line);
    if (step?.[1] !== undefined) {
      startList('steps').push(step[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line.trimEnd());
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * One line for a cramped preview such as the admin ledger: markers and blank
 * lines dropped, so a bulleted description does not show its hyphens.
 */
export function descriptionPreview(text: string): string {
  return descriptionBlocks(text)
    .flatMap((block) =>
      block.type === 'paragraph' ? [block.text] : block.items,
    )
    .join(' · ');
}

export type ListEdit = {
  value: string;
  /** The range the author should end up with selected. */
  selectionStart: number;
  selectionEnd: number;
};

/**
 * Turns the lines the selection touches into a bulleted or numbered list, or
 * back into plain lines when they are already that kind of list. The work is
 * done on the text rather than on the DOM, so the caller only has to write the
 * value back and restore the selection.
 *
 * Existing markers of either kind are replaced, so a bullet can become a step
 * without a stray hyphen, and blank lines are left alone so a list can hold
 * spacing between groups.
 */
export function applyListMarkers(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  kind: ListKind,
): ListEdit {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineBreak = value.indexOf('\n', end);
  const blockEnd = lineBreak === -1 ? value.length : lineBreak;

  const lines = value.slice(blockStart, blockEnd).split('\n');
  const marker = kind === 'bullets' ? BULLET_MARKER : STEP_MARKER;
  const filled = lines.filter((line) => line.trim().length > 0);

  // A button pressed on an empty line should type the marker, not do nothing.
  if (filled.length === 0) {
    const typed = kind === 'bullets' ? '- ' : '1. ';
    return {
      value: value.slice(0, blockStart) + typed + value.slice(blockEnd),
      selectionStart: blockStart + typed.length,
      selectionEnd: blockStart + typed.length,
    };
  }

  const isList = filled.every((line) => marker.test(line));

  let step = 0;
  const next = lines.map((line) => {
    if (line.trim().length === 0) {
      return line;
    }
    // Indentation is the author's, not the list's, so it stays put.
    const indent = /^\s*/.exec(line)?.[0] ?? '';
    const bare = line.replace(ANY_MARKER, '').trimStart();
    if (isList) {
      return `${indent}${bare}`;
    }
    step += 1;
    return kind === 'bullets'
      ? `${indent}- ${bare}`
      : `${indent}${step}. ${bare}`;
  });

  const block = next.join('\n');
  return {
    value: value.slice(0, blockStart) + block + value.slice(blockEnd),
    selectionStart: blockStart,
    selectionEnd: blockStart + block.length,
  };
}
