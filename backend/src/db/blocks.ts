import { query } from './index';
import type { NoteBlock, NoteBlockRow } from '../types';

const BLOCK_COLS = 'id, note_id, type, position, version, data';

function rowToBlock(r: NoteBlockRow): NoteBlock {
  return {
    id: r.id,
    note_id: r.note_id,
    type: r.type,
    position: r.position,
    version: r.version,
    data: r.data ?? {},
  };
}

export async function listBlocksByNote(noteId: string): Promise<NoteBlock[]> {
  const { rows } = await query<NoteBlockRow>(
    `SELECT ${BLOCK_COLS} FROM note_blocks WHERE note_id = $1 ORDER BY position`,
    [noteId]
  );
  return rows.map(rowToBlock);
}

export async function getBlockById(id: string): Promise<NoteBlock | null> {
  const { rows } = await query<NoteBlockRow>(
    `SELECT ${BLOCK_COLS} FROM note_blocks WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToBlock(rows[0]) : null;
}

export async function createBlock(
  noteId: string,
  type: string,
  position: string,
  data: Record<string, unknown> = {}
): Promise<NoteBlock> {
  const { rows } = await query<NoteBlockRow>(
    `INSERT INTO note_blocks (note_id, type, position, data) VALUES ($1, $2, $3, $4) RETURNING ${BLOCK_COLS}`,
    [noteId, type, position, JSON.stringify(data)]
  );
  return rowToBlock(rows[0]);
}

export async function updateBlock(
  id: string,
  data: { type?: string; position?: string; data?: Record<string, unknown>; version?: number }
): Promise<NoteBlock | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.type !== undefined) {
    updates.push(`type = $${i++}`);
    values.push(data.type);
  }
  if (data.position !== undefined) {
    updates.push(`position = $${i++}`);
    values.push(data.position);
  }
  if (data.data !== undefined) {
    updates.push(`data = $${i++}`);
    values.push(JSON.stringify(data.data));
  }
  if (data.version !== undefined) {
    updates.push(`version = $${i++}`);
    values.push(data.version);
  }
  if (updates.length === 0) return getBlockById(id);
  values.push(id);
  const { rows } = await query<NoteBlockRow>(
    `UPDATE note_blocks SET ${updates.join(', ')} WHERE id = $${i} RETURNING ${BLOCK_COLS}`,
    values
  );
  return rows[0] ? rowToBlock(rows[0]) : null;
}

export async function deleteBlock(id: string): Promise<boolean> {
  const result = await query('DELETE FROM note_blocks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/** Rebalance positions to 1.0, 2.0, 3.0, ... for a note (avoid numeric drift). */
export async function rebalancePositions(noteId: string): Promise<void> {
  const blocks = await listBlocksByNote(noteId);
  for (let i = 0; i < blocks.length; i++) {
    const newPos = String(i + 1);
    if (blocks[i].position !== newPos) {
      await query(
        'UPDATE note_blocks SET position = $1 WHERE id = $2',
        [newPos, blocks[i].id]
      );
    }
  }
}
