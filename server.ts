import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getGeminiClient,
  handleAskCoordinator,
  handleAskHub,
} from './api/_assistants.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT) || 3000;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiReady: Boolean(getGeminiClient()),
  });
});

app.post('/api/ask-hub', async (req, res) => {
  const result = await handleAskHub(req.body);
  res.status(result.status).json(result.body);
});

app.post('/api/ask-coordinator', async (req, res) => {
  const result = await handleAskCoordinator(req.body);
  res.status(result.status).json(result.body);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YAO English Teacher Hub listening on http://localhost:${PORT}`);
  });
}

startServer();
