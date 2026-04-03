import { Router, Request, Response } from 'express';
import { canReadPrivate, requireAdmin, requireAuthenticated } from '../auth/middleware';
import * as notesDb from '../db/notes';
import * as blocksDb from '../db/blocks';
import * as commentsDb from '../db/comments';
import * as searchDb from '../db/search';
import * as spacesDb from '../db/spaces';
import * as noteDraftsDb from '../db/note-drafts';
import type { AuthenticatedUser, NoteVisibility } from '../types';

const router = Router();
type AuthRequest = Request & { auth?: AuthenticatedUser };
type PresenceActivity = 'Viewing' | 'Editing';

interface PresenceRow {
  noteId: string;
  userId: number;
  label: string;
  email: string | null;
  initials: string;
  avatarColor: string | null;
  activity: PresenceActivity;
  updatedAt: number;
}

const NOTE_PRESENCE_TTL_MS = 45_000;
const notePresence = new Map<string, PresenceRow>();

function presenceKey(noteId: string, userId: number): string {
  return `${noteId}:${userId}`;
}

function prunePresence(now = Date.now()): void {
  for (const [key, row] of notePresence.entries()) {
    if (now - row.updatedAt > NOTE_PRESENCE_TTL_MS) {
      notePresence.delete(key);
    }
  }
}

function listPresence(
  noteId: string
): Array<Omit<PresenceRow, 'updatedAt' | 'noteId' | 'userId'> & { id: number }> {
  prunePresence();
  const rows = Array.from(notePresence.values()).filter((row) => row.noteId === noteId);
  rows.sort((a, b) => {
    if (a.activity !== b.activity) {
      return a.activity === 'Editing' ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });
  return rows.map((row) => ({
    id: row.userId,
    label: row.label,
    email: row.email,
    initials: row.initials,
    avatarColor: row.avatarColor,
    activity: row.activity,
  }));
}

router.get('/', async (req: Request, res: Response) => {
  const folderId = req.query.folder_id;
  if (folderId === undefined || folderId === '') {
    res.status(400).json({ error: 'FOLDER_ID_REQUIRED' });
    return;
  }
  const fid = Number(folderId);
  if (Number.isNaN(fid)) {
    res.status(400).json({ error: 'INVALID_FOLDER_ID' });
    return;
  }
  const notes = await notesDb.listNotesByFolder(fid, canReadPrivate(req));
  res.json(notes);
});

/** Domain action: move note to another folder and/or position. Body: { note_id, new_folder_id, new_position } */
router.patch('/move', requireAdmin, async (req: Request, res: Response) => {
  const { note_id, new_folder_id, new_position } = req.body;
  if (!note_id || typeof note_id !== 'string') {
    res.status(400).json({ error: 'NOTE_ID_REQUIRED' });
    return;
  }
  const newFolderId = Number(new_folder_id);
  if (Number.isNaN(newFolderId)) {
    res.status(400).json({ error: 'INVALID_NEW_FOLDER_ID' });
    return;
  }
  const newPosition = new_position !== undefined ? String(new_position) : '1';
  const note = await notesDb.moveNote(note_id, newFolderId, newPosition);
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(note);
});

router.get('/:id', async (req: Request, res: Response) => {
  const note = await notesDb.getNoteById(req.params.id, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const isAboutNote = (await spacesDb.getSpaceIdByAboutNoteId(note.id)) !== null;
  res.json({ ...note, is_about_note: isAboutNote });
});

router.get('/:noteId/presence', async (req: Request, res: Response) => {
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(listPresence(req.params.noteId));
});

router.post('/:noteId/presence', async (req: Request, res: Response) => {
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const authReq = req as AuthRequest;
  if (!authReq.auth) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }
  const requestedActivity = req.body?.activity;
  const activity: PresenceActivity = requestedActivity === 'Editing' ? 'Editing' : 'Viewing';
  const label =
    authReq.auth.nickname?.trim() || authReq.auth.email?.trim() || `User ${authReq.auth.id}`;
  const initials =
    authReq.auth.avatar_initials?.trim() || label.slice(0, 2).toUpperCase();
  notePresence.set(presenceKey(req.params.noteId, authReq.auth.id), {
    noteId: req.params.noteId,
    userId: authReq.auth.id,
    label,
    email: authReq.auth.email,
    initials,
    avatarColor: authReq.auth.avatar_color,
    activity,
    updatedAt: Date.now(),
  });
  res.json(listPresence(req.params.noteId));
});

router.get('/:noteId/draft', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const draft = await noteDraftsDb.getNoteDraft(req.params.noteId, authReq.auth!.id);
  if (!draft) {
    res.json(null);
    return;
  }
  res.json({
    note_id: draft.note_id,
    user_id: draft.user_id,
    doc: draft.doc,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
  });
});

router.put('/:noteId/draft', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const doc = req.body?.doc;
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    res.status(400).json({ error: 'DOC_REQUIRED' });
    return;
  }
  await noteDraftsDb.upsertNoteDraft(req.params.noteId, authReq.auth!.id, doc as Record<string, unknown>);
  res.status(204).send();
});

router.delete('/:noteId/draft', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  await noteDraftsDb.deleteNoteDraft(req.params.noteId, authReq.auth!.id);
  res.status(204).send();
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const { folder_id, title, visibility, position } = req.body;
  const folderId = Number(folder_id);
  if (Number.isNaN(folderId)) {
    res.status(400).json({ error: 'INVALID_FOLDER_ID' });
    return;
  }
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'TITLE_REQUIRED' });
    return;
  }
  const vis: NoteVisibility =
    visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
  const pos = position !== undefined ? String(position) : undefined;
  const note = await notesDb.createNote(folderId, title.trim(), vis, pos, authReq.auth!.id);
  await searchDb.updateSearchableTsv(note.id);
  res.status(201).json(note);
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { title, visibility, position } = req.body;
  const data: { title?: string; visibility?: NoteVisibility; position?: string } = {};
  if (typeof title === 'string') data.title = title.trim();
  if (visibility === 'PUBLIC' || visibility === 'PRIVATE') data.visibility = visibility;
  if (position !== undefined) data.position = String(position);
  const note = await notesDb.updateNote(req.params.id, data);
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (data.title !== undefined) await searchDb.updateSearchableTsv(note.id);
  res.json(note);
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const noteId = req.params.id;
  const spaceId = await spacesDb.getSpaceIdByAboutNoteId(noteId);
  if (spaceId !== null) {
    res.status(403).json({ error: 'Cannot delete the About note of a space' });
    return;
  }
  const deleted = await notesDb.deleteNote(noteId);
  if (!deleted) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

// Blocks under a note
router.get('/:noteId/blocks', async (req: Request, res: Response) => {
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const blocks = await blocksDb.listBlocksByNote(req.params.noteId);
  res.json(blocks);
});

router.get('/:noteId/comments', async (req: Request, res: Response) => {
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const comments = await commentsDb.listCommentsByNote(req.params.noteId);
  res.json(comments);
});

router.post('/:noteId/comments', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const { content } = req.body;
  if (typeof content !== 'string' || content.trim().length < 1) {
    res.status(400).json({ error: 'CONTENT_REQUIRED' });
    return;
  }
  if (content.trim().length > 5000) {
    res.status(400).json({ error: 'CONTENT_TOO_LONG' });
    return;
  }

  const comment = await commentsDb.createComment(
    req.params.noteId,
    authReq.auth!,
    content
  );
  res.status(201).json(comment);
});

router.delete(
  '/:noteId/comments/:commentId',
  requireAuthenticated,
  async (req: Request, res: Response) => {
    const authReq = req as AuthRequest;
    const note = await notesDb.getNoteById(req.params.noteId, canReadPrivate(req));
    if (!note) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const comment = await commentsDb.getCommentById(req.params.commentId);
    if (!comment || comment.note_id !== req.params.noteId) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const canDelete =
      authReq.auth!.role === 'ADMIN' || comment.author_id === authReq.auth!.id;
    if (!canDelete) {
      res.status(403).json({ error: 'COMMENT_DELETE_FORBIDDEN' });
      return;
    }

    await commentsDb.deleteComment(comment.id);
    res.status(204).send();
  }
);

router.post('/:noteId/blocks', requireAdmin, async (req: Request, res: Response) => {
  const { type, position, data } = req.body;
  if (!type || typeof type !== 'string') {
    res.status(400).json({ error: 'TYPE_REQUIRED' });
    return;
  }
  const pos = position !== undefined ? String(position) : '1';
  const block = await blocksDb.createBlock(
    req.params.noteId,
    type,
    pos,
    typeof data === 'object' && data !== null ? data : {}
  );
  await notesDb.touchNote(req.params.noteId);
  await searchDb.updateSearchableTsv(req.params.noteId);
  res.status(201).json(block);
});

router.patch('/:noteId/blocks/:blockId', requireAdmin, async (req: Request, res: Response) => {
  const { blockId, noteId } = req.params;
  const { type, position, data, version } = req.body;
  const update: { type?: string; position?: string; data?: Record<string, unknown>; version?: number } = {};
  if (typeof type === 'string') update.type = type;
  if (position !== undefined) update.position = String(position);
  if (data !== undefined && typeof data === 'object') update.data = data;
  if (typeof version === 'number') update.version = version;
  const block = await blocksDb.updateBlock(blockId, update);
  if (!block) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (block.note_id !== noteId) {
    res.status(400).json({ error: 'BLOCK_NOT_IN_NOTE' });
    return;
  }
  await notesDb.touchNote(noteId);
  await searchDb.updateSearchableTsv(noteId);
  res.json(block);
});

router.delete('/:noteId/blocks/:blockId', requireAdmin, async (req: Request, res: Response) => {
  const block = await blocksDb.getBlockById(req.params.blockId);
  if (!block) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (block.note_id !== req.params.noteId) {
    res.status(400).json({ error: 'BLOCK_NOT_IN_NOTE' });
    return;
  }
  await blocksDb.deleteBlock(req.params.blockId);
  await notesDb.touchNote(req.params.noteId);
  await searchDb.updateSearchableTsv(req.params.noteId);
  res.status(204).send();
});

router.post('/:noteId/blocks/rebalance', requireAdmin, async (req: Request, res: Response) => {
  await blocksDb.rebalancePositions(req.params.noteId);
  await notesDb.touchNote(req.params.noteId);
  res.status(204).send();
});

export default router;
