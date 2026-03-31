import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import express, { Request, Response } from 'express';
import { config } from './config';
import { optionalAuth } from './auth/middleware';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import foldersRouter from './routes/folders';
import notesRouter from './routes/notes';
import searchRouter from './routes/search';
import spacesRouter from './routes/spaces';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const corsOrigins = config.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use(optionalAuth);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/notes', notesRouter);
app.use('/api/search', searchRouter);
app.use('/api/spaces', spacesRouter);

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

app.listen(config.port, () => {
  console.log(`Backend running at http://localhost:${config.port}`);
});
