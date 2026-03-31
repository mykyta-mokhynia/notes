import { Router, Request, Response } from 'express';
import { requireAdmin } from '../auth/middleware';
import * as usersDb from '../db/users';
import * as commentsDb from '../db/comments';

const router = Router();

router.get('/users', requireAdmin, async (_req: Request, res: Response) => {
  const users = await usersDb.listUsersForAdmin();
  res.json(users);
});

router.get('/comments', requireAdmin, async (req: Request, res: Response) => {
  const rawLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(500, rawLimit))
    : 100;
  const comments = await commentsDb.listRecentCommentsForAdmin(limit);
  res.json(comments);
});

router.delete(
  '/comments/:commentId',
  requireAdmin,
  async (req: Request, res: Response) => {
    const deleted = await commentsDb.deleteComment(req.params.commentId);
    if (!deleted) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  }
);

export default router;
