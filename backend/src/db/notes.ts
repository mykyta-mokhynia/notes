import { query } from './index';
import type { Note, NoteRow, NoteVisibility } from '../types';

const NOTE_COLS =
  'id, folder_id, title, position, visibility, created_at, updated_at, search_dirty';

function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    folder_id: r.folder_id,
    title: r.title,
    position: r.position,
    visibility: r.visibility,
    created_at: r.created_at,
    updated_at: r.updated_at,
    search_dirty: r.search_dirty,
  };
}

export async function listNotesByFolder(folderId: number): Promise<Note[]> {
  const { rows } = await query<NoteRow>(
    `SELECT ${NOTE_COLS} FROM notes WHERE folder_id = $1 ORDER BY position, created_at`,
    [folderId]
  );
  return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const { rows } = await query<NoteRow>(
    `SELECT ${NOTE_COLS} FROM notes WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function createNote(
  folderId: number,
  title: string,
  visibility: NoteVisibility = 'PRIVATE',
  position?: string
): Promise<Note> {
  const pos = position ?? '1';
  const { rows } = await query<NoteRow>(
    `INSERT INTO notes (folder_id, title, position, visibility) VALUES ($1, $2, $3, $4) RETURNING ${NOTE_COLS}`,
    [folderId, title, pos, visibility]
  );
  return rowToNote(rows[0]);
}

export async function updateNote(
  id: string,
  data: { title?: string; visibility?: NoteVisibility; position?: string }
): Promise<Note | null> {
  const updates: string[] = ['updated_at = now()'];
  const values: unknown[] = [];
  let i = 1;
  if (data.title !== undefined) {
    updates.push(`title = $${i++}`);
    values.push(data.title);
  }
  if (data.visibility !== undefined) {
    updates.push(`visibility = $${i++}`);
    values.push(data.visibility);
  }
  if (data.position !== undefined) {
    updates.push(`position = $${i++}`);
    values.push(data.position);
  }
  if (updates.length === 1) return getNoteById(id);
  values.push(id);
  const { rows } = await query<NoteRow>(
    `UPDATE notes SET ${updates.join(', ')} WHERE id = $${i} RETURNING ${NOTE_COLS}`,
    values
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function deleteNote(id: string): Promise<boolean> {
  const result = await query('DELETE FROM notes WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Move note to another folder and/or change position (domain action).
 */
export async function moveNote(
  noteId: string,
  newFolderId: number,
  newPosition: string
): Promise<Note | null> {
  const { rows } = await query<NoteRow>(
    `UPDATE notes SET folder_id = $1, position = $2, updated_at = now() WHERE id = $3 RETURNING ${NOTE_COLS}`,
    [newFolderId, newPosition, noteId]
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}
