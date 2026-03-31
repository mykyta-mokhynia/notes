import { query } from './index';
import type {
  AuthenticatedUser,
  CommentAuthorType,
  NoteComment,
  NoteCommentRow,
} from '../types';

const COMMENT_COLS = [
  'id',
  'note_id',
  'author_id',
  'author_type',
  'author_role',
  'nickname',
  'avatar_initials',
  'avatar_color',
  'content',
  'created_at',
  'updated_at',
].join(', ');

function rowToComment(row: NoteCommentRow): NoteComment {
  return {
    id: row.id,
    note_id: row.note_id,
    author_id: row.author_id,
    author_type: row.author_type,
    author_role: row.author_role,
    nickname: row.nickname,
    avatar_initials: row.avatar_initials,
    avatar_color: row.avatar_color,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface AdminCommentSummary extends NoteComment {
  note_title: string;
}

function authorTypeForUser(user: AuthenticatedUser): CommentAuthorType {
  return user.role === 'GUEST' ? 'GUEST' : 'USER';
}

export async function listCommentsByNote(noteId: string): Promise<NoteComment[]> {
  const { rows } = await query<NoteCommentRow>(
    `SELECT ${COMMENT_COLS}
     FROM note_comments
     WHERE note_id = $1
     ORDER BY created_at ASC`,
    [noteId]
  );
  return rows.map(rowToComment);
}

export async function getCommentById(id: string): Promise<NoteComment | null> {
  const { rows } = await query<NoteCommentRow>(
    `SELECT ${COMMENT_COLS}
     FROM note_comments
     WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToComment(rows[0]) : null;
}

export async function listRecentCommentsForAdmin(
  limit = 100
): Promise<AdminCommentSummary[]> {
  const { rows } = await query<(NoteCommentRow & { note_title: string })>(
    `SELECT
       ${COMMENT_COLS},
       notes.title AS note_title
     FROM note_comments
     JOIN notes ON notes.id = note_comments.note_id
     ORDER BY note_comments.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    ...rowToComment(row),
    note_title: row.note_title,
  }));
}

export async function createComment(
  noteId: string,
  author: AuthenticatedUser,
  content: string
): Promise<NoteComment> {
  const nickname = author.nickname?.trim() || author.email?.trim() || 'Guest';
  const initials = author.avatar_initials || nickname.slice(0, 2).toUpperCase() || 'GU';
  const color = author.avatar_color || '#5B8DEF';

  const { rows } = await query<NoteCommentRow>(
    `INSERT INTO note_comments (
      note_id,
      author_id,
      author_type,
      author_role,
      nickname,
      avatar_initials,
      avatar_color,
      content
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING ${COMMENT_COLS}`,
    [
      noteId,
      author.id,
      authorTypeForUser(author),
      author.role,
      nickname,
      initials,
      color,
      content.trim(),
    ]
  );
  return rowToComment(rows[0]);
}

export async function deleteComment(id: string): Promise<boolean> {
  const result = await query(`DELETE FROM note_comments WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
