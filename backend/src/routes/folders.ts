import { Router, Request, Response } from 'express';
import * as foldersDb from '../db/folders';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const tree = await foldersDb.listFoldersTree();
  res.json(tree);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const folder = await foldersDb.getFolderById(id);
  if (!folder) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(folder);
});

router.post('/', async (req: Request, res: Response) => {
  const { parent_id, title, position } = req.body;
  const parentId = parent_id === undefined || parent_id === null ? null : Number(parent_id);
  const pos = typeof position === 'string' ? position : String(position ?? '1');
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'TITLE_REQUIRED' });
    return;
  }
  const folder = await foldersDb.createFolder(parentId, title.trim(), pos);
  res.status(201).json(folder);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const { title, position } = req.body;
  const data: { title?: string; position?: string } = {};
  if (typeof title === 'string') data.title = title.trim();
  if (position !== undefined) data.position = String(position);
  const folder = await foldersDb.updateFolder(id, data);
  if (!folder) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(folder);
});

router.patch('/:id/move', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const { new_parent_id } = req.body;
  const newParentId =
    new_parent_id === undefined || new_parent_id === null ? null : Number(new_parent_id);
  if (newParentId !== null && Number.isNaN(newParentId)) {
    res.status(400).json({ error: 'INVALID_NEW_PARENT_ID' });
    return;
  }
  const folder = await foldersDb.moveFolder(id, newParentId);
  if (!folder) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(folder);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const deleted = await foldersDb.deleteFolder(id);
  if (!deleted) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

export default router;
