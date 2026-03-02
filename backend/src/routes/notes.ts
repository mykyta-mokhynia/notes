import { Router, Request, Response } from 'express';
import * as notesDb from '../db/notes';
import * as blocksDb from '../db/blocks';
import * as searchDb from '../db/search';
import * as spacesDb from '../db/spaces';
import type { NoteVisibility } from '../types';

const router = Router();

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
  const notes = await notesDb.listNotesByFolder(fid);
  res.json(notes);
});

/** Domain action: move note to another folder and/or position. Body: { note_id, new_folder_id, new_position } */
router.patch('/move', async (req: Request, res: Response) => {
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
  const note = await notesDb.getNoteById(req.params.id);
  if (!note) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const isAboutNote = (await spacesDb.getSpaceIdByAboutNoteId(note.id)) !== null;
  res.json({ ...note, is_about_note: isAboutNote });
});

router.post('/', async (req: Request, res: Response) => {
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
  const note = await notesDb.createNote(folderId, title.trim(), vis, pos);
  await searchDb.updateSearchableTsv(note.id);
  res.status(201).json(note);
});

router.patch('/:id', async (req: Request, res: Response) => {
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

router.delete('/:id', async (req: Request, res: Response) => {
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
  const blocks = await blocksDb.listBlocksByNote(req.params.noteId);
  res.json(blocks);
});

router.post('/:noteId/blocks', async (req: Request, res: Response) => {
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
  await searchDb.updateSearchableTsv(req.params.noteId);
  res.status(201).json(block);
});

router.patch('/:noteId/blocks/:blockId', async (req: Request, res: Response) => {
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
  await searchDb.updateSearchableTsv(noteId);
  res.json(block);
});

router.delete('/:noteId/blocks/:blockId', async (req: Request, res: Response) => {
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
  await searchDb.updateSearchableTsv(req.params.noteId);
  res.status(204).send();
});

router.post('/:noteId/blocks/rebalance', async (req: Request, res: Response) => {
  await blocksDb.rebalancePositions(req.params.noteId);
  res.status(204).send();
});

export default router;
