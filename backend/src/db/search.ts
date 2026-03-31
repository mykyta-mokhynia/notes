import { query } from './index';
import * as blocksDb from './blocks';
import * as notesDb from './notes';

/** Max chars to aggregate for sync tsv update; above this set search_dirty only. */
const SYNC_TSV_LIMIT = 50000;

function textFromTiptapNode(node: {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
}): string {
  const parts: string[] = [];
  if (typeof node.text === 'string') {
    parts.push(node.text);
  }
  if (node.type === 'image' && typeof node.attrs?.['alt'] === 'string') {
    parts.push(node.attrs['alt']);
  }
  if (node.type === 'databaseSchema') {
    if (typeof node.attrs?.['title'] === 'string') parts.push(node.attrs['title']);
    if (typeof node.attrs?.['body'] === 'string') parts.push(node.attrs['body']);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) {
        parts.push(
          textFromTiptapNode(child as {
            type?: string;
            text?: string;
            attrs?: Record<string, unknown>;
            content?: unknown[];
          })
        );
      }
    }
  }
  return parts.join(' ');
}

function textFromTiptapDoc(doc: { content?: Array<{ type?: string; content?: unknown[]; text?: string }> }): string {
  if (!Array.isArray(doc.content)) return '';
  return doc.content
    .map((node) =>
      textFromTiptapNode(node as {
        type?: string;
        text?: string;
        attrs?: Record<string, unknown>;
        content?: unknown[];
      })
    )
    .join(' ');
}

/**
 * Extract plain text from block data for FTS.
 * - text / rich_text block: data.content (string) or data.doc (tiptap JSON)
 * - code block: data.raw_code
 * - db_schema block: title/body/schema strings
 */
function textFromBlock(type: string, data: Record<string, unknown>): string {
  if (!data) return '';
  if (type === 'text' || type === 'rich_text') {
    if (typeof data.content === 'string') return data.content;
    if (data.doc && typeof data.doc === 'object' && Array.isArray((data.doc as { content?: unknown[] }).content)) {
      return textFromTiptapDoc(
        data.doc as { content?: Array<{ type?: string; content?: unknown[]; text?: string }> }
      );
    }
    return '';
  }
  if (type === 'code' && typeof data.raw_code === 'string') return data.raw_code;
  if (type === 'db_schema') {
    return [data['title'], data['body'], data['schema']]
      .filter((value): value is string => typeof value === 'string')
      .join(' ');
  }
  return '';
}

/**
 * Recompute searchable_tsv for a note. Sync if total text <= SYNC_TSV_LIMIT, else set search_dirty.
 */
export async function updateSearchableTsv(noteId: string): Promise<void> {
  const note = await notesDb.getNoteById(noteId);
  if (!note) return;
  const blocks = await blocksDb.listBlocksByNote(noteId);
  const parts: string[] = [note.title];
  for (const b of blocks) {
    parts.push(textFromBlock(b.type, b.data ?? {}));
  }
  const fullText = parts.join(' ').trim();
  if (fullText.length > SYNC_TSV_LIMIT) {
    await query(
      'UPDATE notes SET search_dirty = true WHERE id = $1',
      [noteId]
    );
    return;
  }
  const escaped = fullText.replace(/'/g, "''");
  await query(
    `UPDATE notes SET searchable_tsv = to_tsvector('simple', $1::text), search_dirty = false WHERE id = $2`,
    [escaped, noteId]
  );
}
