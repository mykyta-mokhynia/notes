import { Router, Request, Response } from 'express';
import { canReadPrivate, requireAdmin } from '../auth/middleware';
import * as spacesDb from '../db/spaces';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const list = await spacesDb.listSpacesWithNoteCount(canReadPrivate(req));
  res.json(list);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const space = await spacesDb.getSpaceById(id, canReadPrivate(req));
  if (!space) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(space);
});

router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { name, avatar_key } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'NAME_REQUIRED' });
    return;
  }
  const avatarKey = Number(avatar_key ?? 1);
  if (!Number.isInteger(avatarKey) || avatarKey < 1 || avatarKey > 12) {
    res.status(400).json({ error: 'INVALID_AVATAR_KEY' });
    return;
  }
  try {
    const space = await spacesDb.createSpace(name.trim(), avatarKey);
    res.status(201).json(space);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create space failed';
    res.status(500).json({ error: message });
  }
});

router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }
  const { name, visibility, avatar_key } = req.body;
  const data: { name?: string; visibility?: 'PRIVATE' | 'PUBLIC'; avatar_key?: number } = {};
  if (typeof name === 'string') data.name = name.trim();
  if (visibility === 'PUBLIC' || visibility === 'PRIVATE') data.visibility = visibility;
  if (avatar_key !== undefined) {
    const avatarKey = Number(avatar_key);
    if (!Number.isInteger(avatarKey) || avatarKey < 1 || avatarKey > 12) {
      res.status(400).json({ error: 'INVALID_AVATAR_KEY' });
      return;
    }
    data.avatar_key = avatarKey;
  }
  const space = await spacesDb.updateSpace(id, data);
  if (!space) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(space);
});

router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
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
