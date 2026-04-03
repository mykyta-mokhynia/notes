import { query } from './index';

export interface NoteDraftRow {
  note_id: string;
  user_id: number;
  doc: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export async function getNoteDraft(
  noteId: string,
  userId: number
): Promise<NoteDraftRow | null> {
  const { rows } = await query<NoteDraftRow>(
    `SELECT note_id, user_id, doc, created_at, updated_at
     FROM note_drafts
     WHERE note_id = $1 AND user_id = $2`,
    [noteId, userId]
  );
  return rows[0] ?? null;
}

export async function upsertNoteDraft(
  noteId: string,
  userId: number,
  doc: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO note_drafts (note_id, user_id, doc)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (note_id, user_id)
     DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
    [noteId, userId, JSON.stringify(doc)]
  );
}

export async function deleteNoteDraft(noteId: string, userId: number): Promise<void> {
  await query(
    `DELETE FROM note_drafts
     WHERE note_id = $1 AND user_id = $2`,
    [noteId, userId]
  );
}
