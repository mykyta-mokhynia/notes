import { Router, Request, Response } from 'express';
import * as searchDb from '../db/search-api';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const hits = await searchDb.searchFoldersAndNotes(q);
  res.json(hits);
});

export default router;
