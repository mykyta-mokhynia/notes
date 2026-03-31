import { Router, Request, Response } from 'express';
import { canReadPrivate } from '../auth/middleware';
import * as searchDb from '../db/search-api';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const hits = await searchDb.searchFoldersAndNotes(q, canReadPrivate(req));
  res.json(hits);
});

export default router;
