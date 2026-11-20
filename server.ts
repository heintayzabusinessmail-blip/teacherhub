import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT) || 3000;

interface AskResourceInput {
  id: string;
  title: string;
  level: string;
  skill: string;
  type: string;
  description: string;
  url: string;
}

interface AskFaqInput {
  id: string;
  question: string;
  level: string;
  category: string;
  explanation: string;
  example: string;
  checkingQuestion: string;
}

app.post('/api/ask-hub', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Ask the Hub is not configured right now. Please ask Tr Hein directly.',
      });
      return;
    }

    const { question, resources = [], faqs = [] } = req.body as {
      question?: string;
      resources?: AskResourceInput[];
      faqs?: AskFaqInput[];
    };

    if (!question || typeof question !== 'string' || question.trim().length < 2) {
      res.status(400).json({ error: 'Please type a short question.' });
      return;
    }

    const trimmedQuestion = question.trim().slice(0, 400);
    const safeResources = Array.isArray(resources) ? resources.slice(0, 60) : [];
    const safeFaqs = Array.isArray(faqs) ? faqs.slice(0, 60) : [];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const libraryContext = safeResources
      .map(
        (r) =>
          `[RESOURCE id="${r.id}"] Title: ${r.title} | Level: ${r.level} | Skill: ${r.skill} | Type: ${r.type} | Description: ${r.description}`
      )
      .join('\n');

    const faqContext = safeFaqs
      .map(
        (f) =>
          `[FAQ id="${f.id}"] Q: ${f.question} | Level: ${f.level} | Explanation: ${f.explanation} | Example: ${f.example} | Checking Question: ${f.checkingQuestion}`
      )
      .join('\n');

    const systemInstruction = `You are "Ask the Hub", a helpful assistant for YAO English teachers (B1 to C1 English).
STRICT RULES:
1. Answer ONLY using the RESOURCE LIBRARY and SHARED FAQ provided below.
2. NEVER invent, guess, or mention any resource, link, book, or rule that is NOT explicitly in the provided lists.
3. Use warm, clear, simple English (short sentences, no unexplained jargon).
4. Always return the exact IDs of the resources and/or FAQs you used.
5. If the provided library and FAQ do not clearly answer the teacher's question, set "found" to false, return empty ID arrays, and set "answer" to exactly: "I don't know, ask Tr Hein."`;

    const prompt = `TEACHER QUESTION:
${trimmedQuestion}

RESOURCE LIBRARY:
${libraryContext || '(No resources in library yet)'}

SHARED FAQ:
${faqContext || '(No answered FAQs yet)'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: {
              type: Type.BOOLEAN,
              description: 'True only if the answer comes directly from the provided library or FAQ.',
            },
            answer: {
              type: Type.STRING,
              description: 'Simple, clear answer grounded only in the provided items, or "I don\'t know, ask Tr Hein."',
            },
            usedResourceIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exact IDs from the RESOURCE LIBRARY used to answer.',
            },
            usedFaqIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exact IDs from the SHARED FAQ used to answer.',
            },
          },
          required: ['found', 'answer', 'usedResourceIds', 'usedFaqIds'],
        },
      },
    });

    const raw = (response.text ?? '{}').trim();
    const parsed = JSON.parse(raw) as {
      found: boolean;
      answer: string;
      usedResourceIds: string[];
      usedFaqIds: string[];
    };

    // Guardrail: verify cited IDs genuinely exist in the provided arrays
    const validResIds = new Set(safeResources.map((r) => r.id));
    const validFaqIds = new Set(safeFaqs.map((f) => f.id));
    const verifiedResIds = (parsed.usedResourceIds || []).filter((id) => validResIds.has(id));
    const verifiedFaqIds = (parsed.usedFaqIds || []).filter((id) => validFaqIds.has(id));

    if (!parsed.found || (verifiedResIds.length === 0 && verifiedFaqIds.length === 0)) {
      res.json({
        found: false,
        answer: "I don't know, ask Tr Hein.",
        usedResourceIds: [],
        usedFaqIds: [],
      });
      return;
    }

    res.json({
      found: true,
      answer: parsed.answer,
      usedResourceIds: verifiedResIds,
      usedFaqIds: verifiedFaqIds,
    });
  } catch (err) {
    console.error('Ask the Hub error:', err);
    res.status(500).json({
      error: 'Could not reach Ask the Hub right now. Please search the library below or ask Tr Hein.',
    });
  }
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
