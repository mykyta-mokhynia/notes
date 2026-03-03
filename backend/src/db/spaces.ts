import { query } from './index';
import * as foldersDb from './folders';
import * as notesDb from './notes';
import type { Space, SpaceRow, NoteVisibility } from '../types';

const COLS = 'id, name, root_folder_id, about_note_id, visibility';

function rowToSpace(r: SpaceRow): Space {
  return {
    id: r.id,
    name: r.name,
    root_folder_id: r.root_folder_id,
    about_note_id: r.about_note_id,
    visibility: r.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
  };
}

export async function listSpaces(): Promise<Space[]> {
  const { rows } = await query<SpaceRow>(
    `SELECT ${COLS} FROM spaces ORDER BY id`
  );
  return rows.map(rowToSpace);
}

export interface SpaceWithNoteCount extends Space {
  note_count: number;
}

/** List spaces with note count per space (notes in root folder and all descendants). */
export async function listSpacesWithNoteCount(): Promise<SpaceWithNoteCount[]> {
  const { rows } = await query<SpaceRow & { note_count: number }>(
    `SELECT s.id, s.name, s.root_folder_id, s.about_note_id, s.visibility,
            (SELECT count(*)::int FROM notes n
             INNER JOIN folders f ON n.folder_id = f.id
             WHERE f.path IS NOT NULL AND f.path <@ (SELECT path FROM folders WHERE id = s.root_folder_id)::ltree) AS note_count
     FROM spaces s ORDER BY s.id`
  );
  return rows.map((r) => ({
    ...rowToSpace(r),
    note_count: Number(r.note_count) || 0,
  }));
}

export async function getSpaceById(id: number): Promise<Space | null> {
  const { rows } = await query<SpaceRow>(
    `SELECT ${COLS} FROM spaces WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToSpace(rows[0]) : null;
}

/** Returns space id if this note is the about note of a space, else null. */
export async function getSpaceIdByAboutNoteId(noteId: string): Promise<number | null> {
  const { rows } = await query<{ id: number }>(
    'SELECT id FROM spaces WHERE about_note_id = $1',
    [noteId]
  );
  return rows[0]?.id ?? null;
}

/** Create space: root folder (internal), one About note, space row. Content stays empty. */
export async function createSpace(name: string): Promise<Space> {
  const trimmedName = name.trim();
  const folder = await foldersDb.createFolder(null, '', '1');
  const aboutNote = await notesDb.createNote(
    folder.id,
    `About space ${trimmedName}`,
    'PUBLIC',
    '1'
  );
  const { rows } = await query<SpaceRow>(
    `INSERT INTO spaces (name, root_folder_id, about_note_id) VALUES ($1, $2, $3) RETURNING ${COLS}`,
    [trimmedName, folder.id, aboutNote.id]
  );
  return rowToSpace(rows[0]);
}

export async function updateSpace(
  id: number,
  data: { name?: string; visibility?: NoteVisibility }
): Promise<Space | null> {
  if (data.name === undefined && data.visibility === undefined) return getSpaceById(id);
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(data.name.trim());
  }
  if (data.visibility === 'PUBLIC' || data.visibility === 'PRIVATE') {
    updates.push(`visibility = $${i++}`);
    values.push(data.visibility);
  }
  values.push(id);
  const { rows } = await query<SpaceRow>(
    `UPDATE spaces SET ${updates.join(', ')} WHERE id = $${i} RETURNING ${COLS}`,
    values
  );
  return rows[0] ? rowToSpace(rows[0]) : null;
}

export async function deleteSpace(id: number): Promise<boolean> {
  const result = await query('DELETE FROM spaces WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
