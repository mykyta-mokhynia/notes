import { Router, Request, Response } from 'express';
import * as spacesDb from '../db/spaces';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const list = await spacesDb.listSpacesWithNoteCount();
  res.json(list);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const space = await spacesDb.getSpaceById(id);
  if (!space) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(space);
});

router.post('/', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'NAME_REQUIRED' });
    return;
  }
  try {
    const space = await spacesDb.createSpace(name.trim());
    res.status(201).json(space);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create space failed';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const { name } = req.body;
  const data: { name?: string } = {};
  if (typeof name === 'string') data.name = name.trim();
  const space = await spacesDb.updateSpace(id, data);
  if (!space) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(space);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const deleted = await spacesDb.deleteSpace(id);
  if (!deleted) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.status(204).send();
});

export default router;
