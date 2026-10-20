import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { clientDist, host, port } from './config.js';
import { HttpError } from './lib/http.js';
import { downloadsRouter } from './routes/downloads.js';
import { libraryRouter } from './routes/library.js';
import { musicRouter } from './routes/music.js';
import { searchRouter } from './routes/search.js';
import { streamRouter } from './routes/stream.js';
import { binariesAvailable } from './services/audio.js';
import { downloadManager } from './services/downloadManager.js';
import { warmupYoutube } from './services/youtube.js';

const app = express();
app.disable('x-powered-by');
app.use(
  cors({
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    binaries: binariesAvailable(),
  });
});

app.use('/api', searchRouter);
app.use('/api', musicRouter);
app.use('/api', streamRouter);
app.use('/api', libraryRouter);
app.use('/api', downloadsRouter);

app.use('/api', (_req, _res, next) => {
  next(new HttpError(404, 'API route not found'));
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof Error && process.env.NODE_ENV !== 'production'
        ? error.message
        : 'Internal server error';
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message });
});

const server = app.listen(port, host, () => {
  console.log(`NewPipe Music API listening on http://${host}:${port}`);
  warmupYoutube();
  if (!binariesAvailable()) {
    console.warn('Warning: yt-dlp/ffmpeg missing. Run npm run setup:bin before downloading.');
  }
});

function shutdown(): void {
  downloadManager.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
