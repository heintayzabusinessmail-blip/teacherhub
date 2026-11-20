import { getGeminiClient } from './_assistants.js';

interface VercelLikeReq {
  method?: string;
}

interface VercelLikeRes {
  status: (code: number) => VercelLikeRes;
  json: (data: unknown) => void;
}

export default function handler(_req: VercelLikeReq, res: VercelLikeRes) {
  res.status(200).json({
    ok: true,
    geminiReady: Boolean(getGeminiClient()),
  });
}
