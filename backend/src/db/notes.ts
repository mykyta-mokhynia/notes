import { query } from './index';
import type { Note, NoteRow, NoteVisibility } from '../types';

const NOTE_COLS =
  'n.id, n.folder_id, n.title, n.position, n.visibility, n.created_at, n.updated_at, n.search_dirty, n.created_by_user_id, u.nickname AS creator_nickname, u.avatar_initials AS creator_avatar_initials, u.avatar_color AS creator_avatar_color';

const NOTE_FROM = 'notes n LEFT JOIN users u ON u.id = n.created_by_user_id';

function rowToNote(r: NoteRow): Note {
  return {
    id: r.id,
    folder_id: r.folder_id,
    title: r.title,
    position: r.position,
    visibility: r.visibility,
    created_by_user_id: r.created_by_user_id,
    creator_nickname: r.creator_nickname,
    creator_avatar_initials: r.creator_avatar_initials,
    creator_avatar_color: r.creator_avatar_color,
    created_at: r.created_at,
    updated_at: r.updated_at,
    search_dirty: r.search_dirty,
  };
}

export async function listNotesByFolder(
  folderId: number,
  includePrivate = true
): Promise<Note[]> {
  const visibilityClause = includePrivate ? '' : `AND n.visibility = 'PUBLIC'`;
  const { rows } = await query<NoteRow>(
    `SELECT ${NOTE_COLS}
     FROM ${NOTE_FROM}
     WHERE n.folder_id = $1 ${visibilityClause}
     ORDER BY n.position, n.created_at`,
    [folderId]
  );
  return rows.map(rowToNote);
}

export async function getNoteById(
  id: string,
  includePrivate = true
): Promise<Note | null> {
  const visibilityClause = includePrivate ? '' : `AND n.visibility = 'PUBLIC'`;
  const { rows } = await query<NoteRow>(
    `SELECT ${NOTE_COLS}
     FROM ${NOTE_FROM}
     WHERE n.id = $1 ${visibilityClause}`,
    [id]
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function createNote(
  folderId: number,
  title: string,
  visibility: NoteVisibility = 'PRIVATE',
  position?: string,
  createdByUserId: number | null = null
): Promise<Note> {
  const pos = position ?? '1';
  const { rows } = await query<{ id: string }>(
    `INSERT INTO notes (folder_id, title, position, visibility, created_by_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [folderId, title, pos, visibility, createdByUserId]
  );
  return (await getNoteById(rows[0].id)) as Note;
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
  const { rowCount } = await query(
    `UPDATE notes SET ${updates.join(', ')} WHERE id = $${i}`,
    values
  );
  return rowCount ? getNoteById(id) : null;
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
  const { rowCount } = await query(
    `UPDATE notes SET folder_id = $1, position = $2, updated_at = now() WHERE id = $3`,
    [newFolderId, newPosition, noteId]
  );
  return rowCount ? getNoteById(noteId) : null;
}

export async function touchNote(noteId: string): Promise<boolean> {
  const result = await query(`UPDATE notes SET updated_at = now() WHERE id = $1`, [noteId]);
  return (result.rowCount ?? 0) > 0;
}
