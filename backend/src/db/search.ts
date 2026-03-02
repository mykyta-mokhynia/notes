import { query } from './index';
import * as blocksDb from './blocks';
import * as notesDb from './notes';

/** Max chars to aggregate for sync tsv update; above this set search_dirty only. */
const SYNC_TSV_LIMIT = 50000;

/**
 * Extract plain text from block data for FTS.
 * - text block: data.content (string) or data.doc (tiptap JSON) → text from content
 * - code block: data.raw_code
 */
function textFromBlock(type: string, data: Record<string, unknown>): string {
  if (!data) return '';
  if (type === 'text') {
    if (typeof data.content === 'string') return data.content;
    if (data.doc && typeof data.doc === 'object' && Array.isArray((data.doc as { content?: unknown[] }).content)) {
      return textFromTiptapDoc(data.doc as { content?: Array<{ type?: string; content?: unknown[]; text?: string }> });
    }
    return '';
  }
  if (type === 'code' && typeof data.raw_code === 'string') return data.raw_code;
  return '';
}

function textFromTiptapDoc(doc: { content?: Array<{ type?: string; content?: unknown[]; text?: string }> }): string {
  const parts: string[] = [];
  if (!Array.isArray(doc.content)) return '';
  for (const node of doc.content) {
    if (node.text) parts.push(node.text);
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (typeof child === 'object' && child !== null && 'text' in child && typeof (child as { text: string }).text === 'string') {
          parts.push((child as { text: string }).text);
        }
      }
    }
  }
  return parts.join(' ');
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
