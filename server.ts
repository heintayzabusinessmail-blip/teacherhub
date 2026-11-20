import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

interface HubDocumentInput {
  id: string;
  sourceType: 'resource' | 'tool' | 'faq' | 'guide';
  title: string;
  level?: string;
  skill?: string;
  type?: string;
  summary: string;
  url?: string;
  navTab?: string;
}

interface CoordinatorHistoryTurn {
  role: 'teacher' | 'coordinator';
  text: string;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseJsonSafe<T>(rawText: string | undefined): T {
  const cleaned = (rawText ?? '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

function classifyGeminiError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; code?: number; message?: string };
  const status = Number(e?.status || e?.code || 500);
  const rawMsg = String(e?.message || '');

  if (status === 400 || status === 403 || rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED')) {
    return {
      status: 503,
      message:
        'The AI assistant could not authenticate with the Gemini API. Please check your Gemini API key in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Too many requests right now. Please wait a few seconds and try again, or check your API quota in Settings > Secrets.',
    };
  }
  if (status === 404 || rawMsg.includes('NOT_FOUND')) {
    return {
      status: 502,
      message: 'The AI model endpoint could not be reached right now. Please try again shortly.',
    };
  }
  return {
    status: 500,
    message: 'Could not reach the AI assistant right now. Please try again in a moment.',
  };
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const e = err as { status?: number; code?: number };
      const status = Number(e?.status || e?.code || 500);
      const retryable = status === 429 || status === 500 || status === 503;
      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    geminiReady: Boolean(getGeminiClient()),
  });
});

/**
 * 1. ASK THE HUB — Problem-to-Document Finder
 * Matches a teacher's real classroom/planning problem directly to the right
 * YAO document(s): Resource Library items, Copy & Use Tools, Shared FAQs, and Hub Guides.
 */
app.post('/api/ask-hub', async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Ask the Hub needs a valid Gemini API key configured in Settings > Secrets before it can answer.',
      });
      return;
    }

    const { problem, documents = [] } = req.body as {
      problem?: string;
      documents?: HubDocumentInput[];
    };

    if (!problem || typeof problem !== 'string' || problem.trim().length < 2) {
      res.status(400).json({ error: 'Please describe your teaching problem or what document you need.' });
      return;
    }

    const trimmedProblem = problem.trim().slice(0, 600);
    const safeDocs = Array.isArray(documents) ? documents.slice(0, 120) : [];

    const docCatalog = safeDocs
      .map(
        (d) =>
          `[DOC id="${d.id}" sourceType="${d.sourceType}"] Title: ${d.title}${
            d.level ? ` | Level: ${d.level}` : ''
          }${d.skill ? ` | Skill: ${d.skill}` : ''}${d.type ? ` | Type: ${d.type}` : ''} | Summary: ${d.summary}`
      )
      .join('\n');

    const systemInstruction = `You are "Ask the Hub", the document-matching assistant for YAO English teachers (B1 to C1 English).
Your job: Read the teacher's classroom or planning PROBLEM, and match it to the RIGHT document(s) from the YAO HUB DOCUMENT CATALOG below.

STRICT RULES:
1. Recommend ONLY documents whose exact "id" and "sourceType" exist in the YAO HUB DOCUMENT CATALOG. Never invent links, files, or IDs.
2. Think by problem-solving relevance, not just exact keyword overlap! For example:
   - "students don't finish tasks on time" or "need lesson structure" -> Lesson Plan Template / Class Observation Form.
   - "falling behind coursebook units" -> Weekly Syllabus Tracker.
   - "worried about observations" -> Class Observation Form / Developmental Observation guide / Teacher Promises.
   - "tricky grammar/pronunciation question" -> matching Shared FAQ or Resource Library item.
3. Rank the 1 to 3 MOST relevant documents. For each recommended document, write a crisp, practical "whyItHelps" note explaining exactly which part solves their problem.
4. Keep "summary" warm, clear, and concise (2–3 short sentences in simple English).
5. If genuinely NO document in the catalog relates to the problem, set "found" to false, return an empty recommendations array, and suggest trying "Ask Assistant Coordinator (TKT · TESOL · CELTA)" or asking Tr Hein directly.`;

    const prompt = `TEACHER'S PROBLEM OR NEED:
${trimmedProblem}

YAO HUB DOCUMENT CATALOG:
${docCatalog || '(No documents available)'}`;

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: {
                type: Type.BOOLEAN,
                description: 'True if at least one catalog document meaningfully helps solve the teacher problem.',
              },
              summary: {
                type: Type.STRING,
                description: '2-3 short, friendly sentences explaining how the matched document(s) solve the problem.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: 'Exact id from the YAO HUB DOCUMENT CATALOG.' },
                    sourceType: {
                      type: Type.STRING,
                      description: 'Exact sourceType from catalog: resource, tool, faq, or guide.',
                    },
                    whyItHelps: {
                      type: Type.STRING,
                      description: '1 clear sentence explaining how to use this exact document for their problem.',
                    },
                  },
                  required: ['id', 'sourceType', 'whyItHelps'],
                },
              },
            },
            required: ['found', 'summary', 'recommendations'],
          },
        },
      })
    );

    const parsed = parseJsonSafe<{
      found: boolean;
      summary: string;
      recommendations: Array<{ id: string; sourceType: string; whyItHelps: string }>;
    }>(response.text);

    const docMap = new Map(safeDocs.map((d) => [`${d.sourceType}:${d.id}`, d]));
    const byIdOnly = new Map(safeDocs.map((d) => [d.id, d]));

    const verifiedRecs: Array<{
      id: string;
      sourceType: HubDocumentInput['sourceType'];
      title: string;
      level?: string;
      skill?: string;
      type?: string;
      url?: string;
      navTab?: string;
      whyItHelps: string;
    }> = [];

    const seen = new Set<string>();
    for (const rec of parsed.recommendations || []) {
      const matched = docMap.get(`${rec.sourceType}:${rec.id}`) || byIdOnly.get(rec.id);
      if (!matched) continue;
      const key = `${matched.sourceType}:${matched.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      verifiedRecs.push({
        id: matched.id,
        sourceType: matched.sourceType,
        title: matched.title,
        level: matched.level,
        skill: matched.skill,
        type: matched.type,
        url: matched.url,
        navTab: matched.navTab,
        whyItHelps: (rec.whyItHelps || matched.summary).slice(0, 320),
      });
    }

    if (!parsed.found || verifiedRecs.length === 0) {
      res.json({
        found: false,
        summary:
          "I couldn't find an exact document for that in the YAO Hub library yet. Try asking the Assistant Coordinator (TKT · TESOL · CELTA) right next door for instant teaching ideas, or message Tr Hein directly!",
        recommendations: [],
      });
      return;
    }

    res.json({
      found: true,
      summary: parsed.summary,
      recommendations: verifiedRecs.slice(0, 4),
    });
  } catch (err) {
    console.error('Ask the Hub error:', err);
    const classified = classifyGeminiError(err);
    res.status(classified.status).json({ error: classified.message });
  }
});

/**
 * 2. ASK ASSISTANT COORDINATOR — TKT · TESOL · CELTA Teaching Practice Coach
 * Input-driven multi-turn mentor that answers in Tr Hein's witty, warm, inverted-ratio
 * coaching style with concrete real classroom practice ways + worked examples, and
 * flips a simple meaningful question right back to the teacher.
 */
app.post('/api/ask-coordinator', async (req, res) => {
  try {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Ask Assistant Coordinator needs a valid Gemini API key configured in Settings > Secrets before it can answer.',
      });
      return;
    }

    const {
      message,
      framework = 'All (TKT · TESOL · CELTA)',
      level = 'Any level',
      history = [],
      teacherName = 'Teacher',
    } = req.body as {
      message?: string;
      framework?: string;
      level?: string;
      history?: CoordinatorHistoryTurn[];
      teacherName?: string;
    };

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      res.status(400).json({ error: 'Please type your teaching question or reply first.' });
      return;
    }

    const trimmedMsg = message.trim().slice(0, 800);
    const safeHistory = Array.isArray(history) ? history.slice(-8) : [];

    const historyText = safeHistory
      .map((h) => `${h.role === 'teacher' ? 'TEACHER' : 'ASSISTANT COORDINATOR'}: ${h.text.slice(0, 600)}`)
      .join('\n');

    const systemInstruction = `You are the "Assistant Coordinator" for YAO English — an online English school in Myanmar — coaching fellow English teachers in the warm, funny, human mentoring voice of Tr Hein Tay Za.

YOUR KNOWLEDGE BASE (use accurately and practically):
- Cambridge TKT (Modules 1, 2, 3: language systems & skills, learner needs, lesson planning & resources, classroom management, grading language, interaction patterns, error correction).
- TESOL (Communicative Language Teaching, lowering the affective filter, scaffolding, differentiation, Zoom/online engagement, task staging, feedback).
- Cambridge CELTA (PPP, TTT, TBL, Guided Discovery, MPF — Meaning/Pronunciation/Form, CCQs, ICQs, lowering TTT / maximizing STT, delayed error correction, crisp timing).

YOUR SIGNATURE COACHING STYLE — "INVERTED RATIO" + FUNNY LIKE TR HEIN:
1. INVERT THE RATIO (BE CRISP & PUNCHY): Just like great CELTA/TESOL teachers cut Teacher Talking Time (TTT) and raise Student Talking Time (STT), keep EVERY field short, sharp, and practical — never write a long lecture!
2. FUNNY & WARM OPENER ("funnyReaction"): 1–2 short witty sentences like Tr Hein chatting over coffee — light, relatable ELT humor (never mocking the teacher or students!). If the teacher is replying to your previous question, celebrate their answer playfully first!
3. CLEAR TKT / TESOL / CELTA PRINCIPLE ("frameworkTag" & "pedagogyPrinciple"): Name the exact TKT, TESOL, or CELTA concept (e.g., "CELTA · CCQs & MPF", "TKT Module 3 · ICQs", "TESOL · Lowering TTT") + 1 simple sentence (max 25 words).
4. REAL PRACTICE WAYS WITH WORKED EXAMPLES ("practiceWays"): Give exactly 2 concrete, ready-to-use classroom moves tailored to the teacher's exact input and level:
   - "title": 3–6 words
   - "howToDoIt": 1 short practical sentence (Zoom-friendly where relevant)
   - "realExample": a REAL word-for-word classroom script, CCQs/ICQs with Yes/No answers, or Zoom chat prompt using the teacher's exact topic (1–2 sentences, zero placeholders).
5. FLIP THE RATIO BACK ("questionBack" & "quickReplies"): End with ONE simple, meaningful coaching question thrown back to the teacher + 3 short clickable reply options (max 8 words each) so they answer you back!

LANGUAGE LEVEL: Clear, warm English for B1–C1 Myanmar English teachers. Lens: ${framework} | Level: ${level}.`;

    const prompt = `${historyText ? `CONVERSATION SO FAR:\n${historyText}\n\n` : ''}TEACHER (${teacherName}) SAYS:
${trimmedMsg}

CONTEXT:
- Preferred lens: ${framework}
- Student level: ${level}`;

    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              funnyReaction: {
                type: Type.STRING,
                description: '1-2 warm, witty, funny sentences reacting like Tr Hein.',
              },
              frameworkTag: {
                type: Type.STRING,
                description: 'Short label naming TKT, TESOL, or CELTA concept (e.g., "CELTA · CCQs & MPF").',
              },
              pedagogyPrinciple: {
                type: Type.STRING,
                description: '1 simple, clear sentence explaining why this TKT/TESOL/CELTA principle works.',
              },
              practiceWays: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: 'Short punchy name of the classroom practice move.' },
                    howToDoIt: { type: Type.STRING, description: '1-2 crisp sentences on how to run it in class.' },
                    realExample: {
                      type: Type.STRING,
                      description: 'Real word-for-word classroom script, CCQ/ICQ, or worked example.',
                    },
                  },
                  required: ['title', 'howToDoIt', 'realExample'],
                },
              },
              questionBack: {
                type: Type.STRING,
                description:
                  '1 simple, meaningful coaching question flipped back to the teacher to invite their reply.',
              },
              quickReplies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-3 short, natural teacher replies they can click to answer the question back.',
              },
            },
            required: [
              'funnyReaction',
              'frameworkTag',
              'pedagogyPrinciple',
              'practiceWays',
              'questionBack',
              'quickReplies',
            ],
          },
        },
      })
    );

    const parsed = parseJsonSafe<{
      funnyReaction: string;
      frameworkTag: string;
      pedagogyPrinciple: string;
      practiceWays: Array<{ title: string; howToDoIt: string; realExample: string }>;
      questionBack: string;
      quickReplies: string[];
    }>(response.text);

    res.json({
      funnyReaction: parsed.funnyReaction || '',
      frameworkTag: parsed.frameworkTag || 'TKT · TESOL · CELTA',
      pedagogyPrinciple: parsed.pedagogyPrinciple || '',
      practiceWays: Array.isArray(parsed.practiceWays) ? parsed.practiceWays.slice(0, 3) : [],
      questionBack: parsed.questionBack || 'Which of these moves would you try first in your next lesson?',
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 3) : [],
    });
  } catch (err) {
    console.error('Ask Assistant Coordinator error:', err);
    const classified = classifyGeminiError(err);
    res.status(classified.status).json({ error: classified.message });
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
