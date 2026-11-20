import { handleAskCoordinator, type CoordinatorHistoryTurn } from './_assistants.js';

interface VercelLikeReq {
  method?: string;
  body?: unknown;
}

interface VercelLikeRes {
  status: (code: number) => VercelLikeRes;
  json: (data: unknown) => void;
}

export default async function handler(req: VercelLikeReq, res: VercelLikeRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: {
    message?: string;
    framework?: string;
    level?: string;
    history?: CoordinatorHistoryTurn[];
    teacherName?: string;
  } = {};

  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body);
    } catch {
      body = {};
    }
  } else if (req.body && typeof req.body === 'object') {
    body = req.body as typeof body;
  }

  const result = await handleAskCoordinator(body);
  res.status(result.status).json(result.body);
}
