import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

// Load .env, then backfill any variable that is unset OR defined-but-empty.
// This keeps real platform env vars (e.g. on Render) authoritative, while
// preventing a stray empty shell variable from silently shadowing the .env key.
const loadedEnv = dotenv.config().parsed || {};
for (const [key, value] of Object.entries(loadedEnv)) {
  if (!process.env[key]) process.env[key] = value;
}
import cors from "cors";
import express from "express";
import fs from "fs/promises";
import multer from "multer";
import { PDFParse } from "pdf-parse";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 8787);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("ANTHROPIC_API_KEY is not set. AI routes will fail until you add it to backend/.env.");
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude model selection per task. Override any of these via env vars without code changes.
const MODELS = {
  // Structured extraction of uploaded PDFs into the chapter scaffold.
  parse: process.env.CLAUDE_PARSE_MODEL || "claude-sonnet-4-6",
  // Conversational study assistant.
  chat: process.env.CLAUDE_CHAT_MODEL || "claude-sonnet-4-6",
  // Practice-set generation (highest quality bar — was the flagship model on OpenAI).
  generate: process.env.CLAUDE_GENERATE_MODEL || "claude-opus-4-8",
  // Post-set weak-topic analysis.
  analyze: process.env.CLAUDE_ANALYZE_MODEL || "claude-sonnet-4-6",
};

// Single entry point for Claude calls. Mirrors the old `responses.create` shape:
// pass a system string and a single user text payload, get plain text back.
// When `forceJson` is set we append a firm instruction to emit JSON only.
// (We avoid assistant-message prefill because some models, e.g. Opus 4.8,
// reject it; parseStructuredOutput already extracts the JSON robustly.)
async function runClaude({ model, system, userText, messages, maxTokens = 4096, forceJson = false }) {
  const finalUserText = forceJson
    ? `${userText}\n\nRespond with only the JSON object described in the instructions. Do not write anything before or after the JSON, and do not use markdown code fences.`
    : userText;

  // `messages` (a full multi-turn array) takes precedence; otherwise a single user turn.
  const finalMessages = Array.isArray(messages) && messages.length ? messages : [{ role: "user", content: finalUserText }];

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: finalMessages,
  });

  const text = (response.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, raw: response };
}

const BACKEND_RELEASE = "render-claude-sync-2026-06-01T00:00:00Z";

const OFFICIAL_LEVEL1_OUTLINE_URL = "https://www.cfainstitute.org/sites/default/files/docs/programs/cfa-program/2026-l1-topics-combined.pdf";
const OFFICIAL_LEVEL1_OUTLINE_CACHE = "/tmp/cfa-2026-l1-topics.pdf";
const OFFICIAL_SUBJECT_NAMES = [
  "Quantitative Methods",
  "Economics",
  "Financial Statement Analysis",
  "Corporate Issuers",
  "Equity Investments",
  "Fixed Income",
  "Derivatives",
  "Alternative Investments",
  "Portfolio Management",
  "Ethical and Professional Standards",
];
const OFFICIAL_SUBJECT_ALIASES = {
  Ethics: ["Ethical and Professional Standards"],
  "Corporate Finance": ["Corporate Issuers"],
  "Financial Statement Analysis": ["Financial Statement Analysis"],
  "Quantitative Methods": ["Quantitative Methods"],
  Economics: ["Economics"],
  "Equity Investments": ["Equity Investments"],
  "Fixed Income": ["Fixed Income"],
  Derivatives: ["Derivatives"],
  "Alternative Investments": ["Alternative Investments"],
  "Portfolio Management": ["Portfolio Management"],
};

let officialLosEntriesPromise = null;

function parseStructuredOutput(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeLooseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitleForMatch(value) {
  const stopwords = new Set(["the", "and", "of", "in", "to", "for", "on", "with", "introduction"]);
  return normalizeLooseText(value)
    .split(" ")
    .map((token) => (token.endsWith("s") && token.length > 4 ? token.slice(0, -1) : token))
    .filter((token) => token && !stopwords.has(token));
}

function scoreTitleMatch(left, right) {
  const a = normalizeTitleForMatch(left);
  const b = normalizeTitleForMatch(right);
  if (!a.length || !b.length) return 0;
  const aText = a.join(" ");
  const bText = b.join(" ");
  if (aText === bText) return 1;
  if (aText.includes(bText) || bText.includes(aText)) return 0.94;
  let overlap = 0;
  a.forEach((token) => {
    if (b.includes(token)) overlap += 1;
  });
  return overlap / Math.max(a.length, b.length);
}

function cleanOutlineLine(line) {
  return String(line || "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPageArtifacts(line) {
  return cleanOutlineLine(line).replace(/^\d+\s+/, "").replace(/\s+\d+$/, "").trim();
}

function parseOfficialLosEntries(rawText) {
  const lines = String(rawText || "")
    .split(/\n/)
    .map((line) => cleanOutlineLine(line))
    .filter(Boolean);

  const entries = [];
  let currentSubject = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const stripped = stripPageArtifacts(line);

    if (!stripped || stripped === "2026 Level I Topic Outlines" || stripped === "LEARNING OUTCOMES") continue;
    if (stripped.startsWith("© CFA Institute.") || stripped.startsWith("-- ")) continue;

    if (OFFICIAL_SUBJECT_NAMES.includes(stripped)) {
      currentSubject = stripped;
      continue;
    }

    if (lines[index + 1] === "The candidate should be able to:") {
      const title = stripped;
      index += 2;
      const los = [];
      let currentLos = "";

      for (; index < lines.length; index += 1) {
        const innerLine = lines[index];
        const innerStripped = stripPageArtifacts(innerLine);
        if (!innerStripped || innerStripped === "2026 Level I Topic Outlines" || innerStripped === "LEARNING OUTCOMES") continue;
        if (innerStripped.startsWith("© CFA Institute.") || innerStripped.startsWith("-- ")) continue;
        if (OFFICIAL_SUBJECT_NAMES.includes(innerStripped) || lines[index + 1] === "The candidate should be able to:") {
          break;
        }
        if (innerStripped.startsWith("□")) {
          if (currentLos) los.push(currentLos.trim());
          currentLos = innerStripped.replace(/^□\s*/, "");
        } else if (currentLos) {
          currentLos += ` ${innerStripped}`;
        }
      }

      if (currentLos) los.push(currentLos.trim());
      if (title && los.length) {
        entries.push({ subject: currentSubject, readingTitle: title, los });
      }
      index -= 1;
    }
  }

  return entries;
}

async function getOfficialLosEntries() {
  if (officialLosEntriesPromise) return officialLosEntriesPromise;
  officialLosEntriesPromise = (async () => {
    let pdfBuffer;
    try {
      pdfBuffer = await fs.readFile(OFFICIAL_LEVEL1_OUTLINE_CACHE);
    } catch {
      const response = await fetch(OFFICIAL_LEVEL1_OUTLINE_URL);
      if (!response.ok) {
        throw new Error(`Failed to download official CFA topic outline (${response.status})`);
      }
      pdfBuffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(OFFICIAL_LEVEL1_OUTLINE_CACHE, pdfBuffer);
    }

    const parser = new PDFParse({ data: pdfBuffer });
    const result = await parser.getText();
    await parser.destroy();
    return parseOfficialLosEntries(result.text || "");
  })();

  try {
    return await officialLosEntriesPromise;
  } catch (error) {
    officialLosEntriesPromise = null;
    throw error;
  }
}

async function findOfficialLosForReading(subject, chapterTitle) {
  const entries = await getOfficialLosEntries();
  const allowedSubjects = OFFICIAL_SUBJECT_ALIASES[subject] || [subject];
  const candidates = entries.filter((entry) => !allowedSubjects.length || allowedSubjects.includes(entry.subject));
  let best = null;
  let bestScore = 0;

  candidates.forEach((entry) => {
    const score = scoreTitleMatch(chapterTitle, entry.readingTitle);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  return bestScore >= 0.34 ? best : null;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return String(result.text || "").replace(/\s+/g, " ").trim();
}

async function extractPdfTextWithLines(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return String(result.text || "");
}

function normalizeModuleTitle(value) {
  return normalizeLooseText(value)
    .replace(/\brate\b/g, "rates")
    .replace(/\breturn\b/g, "returns")
    .replace(/\bnon parametric\b/g, "nonparametric")
    .replace(/\btime value of money\b/g, "time value of money in finance")
    .trim();
}

function normalizePdfLine(value) {
  return String(value || "")
    .replace(/\t/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripModulePageArtifacts(value) {
  return normalizePdfLine(value)
    .replace(/^©.*$/, "")
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/, "")
    .replace(/^\d+\s*$/, "")
    .trim();
}

function parseAnalystPrepModules(rawText) {
  const lines = String(rawText || "")
    .split(/\n/)
    .map((line) => stripModulePageArtifacts(line))
    .filter(Boolean);

  const modules = [];
  let currentModule = null;
  let currentLos = "";

  function closeLos() {
    if (currentModule && currentLos) {
      currentModule.losChecklist.push(currentLos.trim());
      currentLos = "";
    }
  }

  function closeModule() {
    closeLos();
    if (currentModule) {
      currentModule.notesExcerpt = currentModule.notesLines.join("\n").trim();
      currentModule.questionExcerpt = currentModule.questionLines.join("\n").trim();
      delete currentModule.notesLines;
      delete currentModule.questionLines;
      modules.push(currentModule);
      currentModule = null;
    }
  }

  for (const line of lines) {
    const moduleMatch = line.match(/^Learning\s+Module\s+(\d+)\s*:\s*(.+)$/i);
    if (moduleMatch) {
      closeModule();
      currentModule = {
        moduleNumber: Number(moduleMatch[1]),
        readingTitle: normalizePdfLine(moduleMatch[2]).replace(/\s+/g, " ").trim(),
        losChecklist: [],
        notesLines: [],
        questionLines: [],
      };
      continue;
    }

    if (!currentModule) continue;

    const losMatch = line.match(/^LOS\s+[\dA-Za-z.() -]*:\s*(.+)$/i);
    if (losMatch) {
      closeLos();
      currentLos = normalizePdfLine(losMatch[1]);
      currentModule.notesLines.push(line);
      continue;
    }

    if (currentLos) {
      const canContinueLos =
        /^[a-z(]/.test(line) &&
        !/^q\.\d+/i.test(line) &&
        !/^the\s+correct\s+answer\s+is/i.test(line) &&
        !/^learning\s+outcome/i.test(line) &&
        !/^cfa\s+level\s+/i.test(line) &&
        !/^using\s+the\s+/i.test(line) &&
        !/^the\s+/i.test(line) &&
        !/^an?\s+/i.test(line) &&
        !/^assume\s+/i.test(line) &&
        !/^there\s+are\s+/i.test(line) &&
        !/^interest\s+/i.test(line) &&
        !/^therefore[, ]/i.test(line) &&
        !/^[1-9]\d*\.\s/.test(line);

      if (canContinueLos) {
        currentLos += ` ${line}`;
        currentModule.notesLines.push(line);
        continue;
      }
      closeLos();
    }

    if (/^Q\.\d+/i.test(line) || /^The\s+correct\s+answer\s+is/i.test(line) || /^A\.\s|^B\.\s|^C\.\s|^D\.\s/.test(line) || /^Using\s+the\s+BA\s+II/i.test(line)) {
      currentModule.questionLines.push(line);
    } else {
      currentModule.notesLines.push(line);
    }
  }

  closeModule();

  return modules.map((module) => ({
    moduleNumber: module.moduleNumber,
    readingTitle: module.readingTitle,
    normalizedTitle: normalizeModuleTitle(module.readingTitle),
    losChecklist: module.losChecklist,
    notesExcerpt: module.notesExcerpt,
    questionExcerpt: module.questionExcerpt,
  }));
}

function mergeModuleSources(notesModules, questionModules) {
  const questionByTitle = new Map(questionModules.map((module) => [module.normalizedTitle, module]));

  if (notesModules.length) {
    return notesModules.map((module) => {
      const questionMatch = questionByTitle.get(module.normalizedTitle);
      return {
        ...module,
        questionExcerpt: questionMatch?.questionExcerpt || questionMatch?.notesExcerpt || "",
      };
    });
  }

  return questionModules.map((module) => ({
    ...module,
    losChecklist: [],
  }));
}

function sampleTextAcrossDocument(text, totalChars = 50000, slices = 6) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  if (clean.length <= totalChars) return clean;

  const segmentLength = Math.floor(totalChars / slices);
  const step = Math.floor((clean.length - segmentLength) / Math.max(1, slices - 1));
  const sampled = [];

  for (let index = 0; index < slices; index += 1) {
    const start = Math.max(0, Math.min(clean.length - segmentLength, index * step));
    const end = start + segmentLength;
    sampled.push(clean.slice(start, end));
  }

  return sampled.join("\n\n");
}

// Maps the app's difficulty tokens ("1"/"2"/"3", plus legacy "exam"/"challenge")
// into concrete, model-readable instructions so the three buttons actually
// change how hard the generated questions are.
const DIFFICULTY_GUIDE = {
  "1": {
    label: "1",
    instruction:
      "Target FOUNDATIONAL difficulty: clear, mostly single-concept questions that check whether the candidate understands the core idea and its basic application. Keep distractors plausible but not tricky. Avoid multi-step traps.",
  },
  "2": {
    label: "2",
    instruction:
      "Target EXAM-REALISTIC difficulty: fair, crisp CFA Level I exam-style questions, coverage-aware and a touch harder than basic recall, with realistic distractors that punish shallow understanding.",
  },
  "3": {
    label: "3",
    instruction:
      "Target CHALLENGE difficulty: still strictly syllabus-faithful but more discriminating — tighter distractors, multi-step application, trap-aware reasoning, and deeper synthesis where the chapter supports it. Difficult for the right reason, never obscure or outside-syllabus.",
  },
};

function resolveDifficulty(value) {
  const key = String(value ?? "2").trim();
  if (DIFFICULTY_GUIDE[key]) return DIFFICULTY_GUIDE[key];
  if (key === "exam") return DIFFICULTY_GUIDE["2"];
  if (key === "challenge") return DIFFICULTY_GUIDE["3"];
  return DIFFICULTY_GUIDE["2"];
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cfa-study-companion-backend", release: BACKEND_RELEASE });
});

app.post(
  "/api/parse-materials",
  upload.fields([
    { name: "notes", maxCount: 1 },
    { name: "questionBank", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      const notesFile = files.notes?.[0];
      const questionBankFile = files.questionBank?.[0];
      const subject = req.body.subject || "Unknown subject";

      if (!questionBankFile) {
        return res.status(400).json({ error: "questionBank PDF is required." });
      }

      const notesRawText = notesFile ? await extractPdfTextWithLines(notesFile.buffer) : "";
      const questionBankRawText = await extractPdfTextWithLines(questionBankFile.buffer);
      const notesText = notesRawText ? notesRawText.replace(/\s+/g, " ").trim() : "";
      const questionBankText = questionBankRawText.replace(/\s+/g, " ").trim();

      const parsedNoteModules = notesRawText ? parseAnalystPrepModules(notesRawText) : [];
      const parsedQuestionModules = parseAnalystPrepModules(questionBankRawText);
      const mergedModules = mergeModuleSources(parsedNoteModules, parsedQuestionModules);
      const syncDebug = {
        release: BACKEND_RELEASE,
        subject,
        notesModuleCount: parsedNoteModules.length,
        questionModuleCount: parsedQuestionModules.length,
        mergedModuleCount: mergedModules.length,
        modules: mergedModules.map((module) => ({
          moduleNumber: module.moduleNumber,
          readingTitle: module.readingTitle,
          losCount: Array.isArray(module.losChecklist) ? module.losChecklist.length : 0,
        })),
      };

      console.log("[parse-materials]", JSON.stringify(syncDebug));

      const compactNotes = sampleTextAcrossDocument(notesText, 12000, 3);
      const compactQuestionBank = sampleTextAcrossDocument(questionBankText, 16000, 4);

      // Fast, AI-free scaffold: build chapters directly from the regex-parsed modules.
      // The heavy per-chapter work (summaries, questions) is deferred to generation
      // time, which reads the raw excerpts stored here. This keeps Sync to a short,
      // reliable request instead of one long blocking AI call that drops connections.
      const emptyChapterFields = {
        notesSummary: "",
        revisionFocus: [],
        keySubtopics: [],
        formulas: [],
        commonTraps: [],
        questionPatterns: [],
        calculatorGuidance: [],
        sourceCoverageGaps: [],
        questions: [],
      };

      const chapters = mergedModules.map((module) => ({
        readingTitle: module.readingTitle,
        losChecklist: Array.isArray(module.losChecklist) ? module.losChecklist.filter(Boolean) : [],
        ...emptyChapterFields,
        notesExcerpt: sampleTextAcrossDocument(module.notesExcerpt, 6000, 1),
        questionExcerpt: sampleTextAcrossDocument(module.questionExcerpt, 8000, 1),
      }));

      // Fallback for PDFs whose chapters the parser couldn't detect: one catch-all
      // chapter holding the sampled text, so generation still has material to work with.
      if (!chapters.length) {
        chapters.push({
          readingTitle: `${subject} — all material`,
          losChecklist: [],
          ...emptyChapterFields,
          notesExcerpt: compactNotes,
          questionExcerpt: compactQuestionBank,
        });
      }

      const structured = { subject, chapters };

      res.json({
        ok: true,
        subject,
        model: "fast-parse (no AI)",
        release: BACKEND_RELEASE,
        syncDebug,
        output_text: JSON.stringify(structured),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Failed to parse uploaded materials.",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

app.post("/api/study-chat", async (req, res) => {
  try {
    const {
      subject = "Unknown subject",
      question = "",
      parsedChapters = [],
      performanceSummary = null,
      aiSummary = "",
      extraContext = {},
      history = [],
      focusChapter = null,
    } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: "question is required." });
    }

    // Build a real multi-turn conversation: prior turns + the new question. The
    // study context (chapters, performance, focus) rides only on the new turn.
    const priorTurns = (Array.isArray(history) ? history : [])
      .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && turn.content.trim())
      .slice(-12)
      .map((turn) => ({ role: turn.role, content: turn.content }));

    const contextPayload = JSON.stringify({ subject, performanceSummary, aiSummary, focusChapter, parsedChapters, extraContext });
    const finalTurn = {
      role: "user",
      content: `${question}\n\n[Reference material for you — use it but do not quote it verbatim]:\n${contextPayload}`,
    };

    const response = await runClaude({
      model: MODELS.chat,
      maxTokens: 2048,
      system:
        "You are a CFA Level I study assistant inside a personal study app, having an ongoing conversation with the student. " +
        "Use the supplied focus chapter, parsed chapters, generated review, and performance summary to answer clearly, practically, and briefly. " +
        "Treat earlier turns as context and answer follow-ups naturally (e.g. 'explain more', 'give an example') without repeating yourself. " +
        "Assume the student uses the BA II Plus financial calculator in the exam. When a numerical topic benefits from it, say where and how the calculator is useful. " +
        "Stay grounded in the supplied material. If the source is unclear, say what is uncertain instead of inventing. " +
        "Format for easy reading: put a short heading for each topic on its own line wrapped in double asterisks like **Heading**, then the explanation below it. Use '- ' at the start of a line for bullet points. Keep paragraphs short. Do not use tables, code fences, or '#' headings. " +
        "If formulas are needed, put each one on its own line, written plainly such as 'Future value = Present value × (1 + r)^n'. " +
        "When helpful, explain why the student's choice was wrong and what concept it confused. " +
        "End with a short 'Revise next:' line only when useful.",
      messages: [...priorTurns, finalTurn],
    });

    res.json({
      ok: true,
      answer: response.text,
      imageUrl: "",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to answer study assistant question.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/generate-flashcards", async (req, res) => {
  try {
    const { subject = "Unknown subject", chapterTitle = "", chapter = null, existingCards = [] } = req.body || {};
    if (!String(chapterTitle).trim() || !chapter) {
      return res.status(400).json({ error: "chapterTitle and chapter are required." });
    }
    const existingFronts = (Array.isArray(existingCards) ? existingCards : []).map((card) => String(card?.front || "").trim()).filter(Boolean);

    const response = await runClaude({
      model: MODELS.chat,
      maxTokens: 4000,
      forceJson: true,
      system:
        "You create CFA Level I study flashcards from the supplied chapter material. " +
        'Return strict JSON only: {"flashcards":[{"front":"","back":"","cardType":"Formula"}]}. ' +
        "cardType must be one of: Formula, Concept, Application, Trap. " +
        "Put ALL the key formulas FIRST as Formula cards — front = the name and when to use it, back = the formula written plainly plus a one-line note. " +
        "Then add the highest-yield Concept, Application and Trap cards. " +
        "Front is a short question or cue; back is a concise, exam-useful answer. Mention BA II Plus usage on the back when it helps. " +
        "Keep the deck LEAN — only the must-know items. Aim for 6 to 12 cards total: every essential formula, plus only the few highest-yield concepts and traps. Do not pad with trivia or near-duplicates. " +
        "Base everything strictly on the supplied material and do not invent. " +
        "If existingCards are supplied, do NOT duplicate or lightly paraphrase any of them — only add genuinely new must-know items the existing deck does not already cover. If nothing important is left, return fewer cards. " +
        "Do not use markdown.",
      userText: JSON.stringify({ subject, chapterTitle, chapter, existingCards: existingFronts }),
    });

    const structured = parseStructuredOutput(response.text);
    const flashcards = Array.isArray(structured?.flashcards) ? structured.flashcards : [];
    if (!flashcards.length) {
      return res.status(500).json({ error: "No flashcards were generated.", details: "AI returned no usable cards." });
    }

    res.json({ ok: true, flashcards });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to generate flashcards.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/generate-practice-set", async (req, res) => {
  try {
    const {
      subject = "Unknown subject",
      chapterTitle = "",
      questionCount = 10,
      difficulty = "exam",
      parsedChapters = [],
      aiSummary = "",
      mode = "standard",
      focusTopics = [],
      baseQuestions = [],
      existingQuestions = [],
      missingTopics = [],
      coverageChecklist = [],
    } = req.body || {};

    if (!String(chapterTitle).trim()) {
      return res.status(400).json({ error: "chapterTitle is required." });
    }

    const cappedCount = Math.max(3, Math.min(40, Number(questionCount || 10)));
    const resolvedDifficulty = resolveDifficulty(difficulty);
    const chapter = Array.isArray(parsedChapters)
      ? parsedChapters.find((item) => String(item?.readingTitle || "").trim() === String(chapterTitle).trim())
      : null;

    if (!chapter) {
      return res.status(400).json({ error: "Could not find that chapter in parsed material." });
    }

    const chapterLosChecklist = Array.isArray(chapter?.losChecklist) ? chapter.losChecklist.filter(Boolean) : [];
    const officialEntry = await findOfficialLosForReading(subject, chapterTitle);
    const effectiveOfficialLos = chapterLosChecklist.length ? chapterLosChecklist : officialEntry?.los || [];
    const effectiveOfficialTitle = chapterLosChecklist.length ? chapterTitle : officialEntry?.readingTitle || "";
    const effectiveCoverageChecklist = Array.isArray(coverageChecklist) && coverageChecklist.length ? coverageChecklist : effectiveOfficialLos;
    const effectiveMissingTopics = Array.isArray(missingTopics) && missingTopics.length ? missingTopics : effectiveCoverageChecklist;

    const response = await runClaude({
      model: MODELS.generate,
      maxTokens: 16000,
      forceJson: true,
      system:
        "You create CFA Level I chapter-wise practice sets from provided source material. " +
        "Generate fresh multiple-choice questions grounded in the supplied chapter notes, revision focus, key subtopics, formulas, common traps, question patterns, calculator guidance, and example questions. " +
        "When those structured fields are empty, treat the chapter's notesExcerpt and questionExcerpt as the authoritative source material and base the questions on them. " +
        "Return strict JSON only with this shape: " +
        '{"practiceSet":{"chapterTitle":"","questionCount":0,"difficulty":"exam","questions":[{"id":"","question":"","options":[],"answer":"","explanation":"","difficulty":"","tags":[]}]}}. ' +
        "Each question must have exactly four options, one correct answer copied exactly from the options array, and a short explanation. " +
        "Follow the supplied difficultyGuidance exactly when deciding how hard to make the questions. " +
        "Set every question's 'difficulty' field to the supplied targetDifficulty value. " +
        "Stay faithful to the supplied source and do not invent formulas or facts that are not supported by the material. " +
        "Use the same style and pattern of questioning suggested by the source material when possible. " +
        "Prioritize uncovered or weak topics first when missingTopics are supplied. " +
        "Do not repeat or lightly paraphrase existingQuestions. Treat near-duplicate questions as invalid. " +
        "Use coverageChecklist to understand the full chapter scope, and use missingTopics as the highest-priority targets. " +
        "If officialLearningOutcomes are supplied, treat them as the authoritative baseline for topic coverage. " +
        "Aim for a rounded set across the official learning outcomes before repeating the same narrow angle. " +
        "For numerical questions, mention BA II Plus usage in the explanation when it would realistically help on the exam. " +
        "If mode is 'similar-questions', generate near-neighbor reinforcement questions around the supplied mistakes. " +
        "If mode is 'weak-topics-retry', focus heavily on the supplied focusTopics. " +
        "If mode is 'review-focus', build a SHORT high-yield retention check: select the topics most likely to be tested on the real CFA Level I exam for this reading, give extra weight to the supplied focusTopics (the candidate's weak areas), and use your own CFA expertise to judge what is high-yield — but stay strictly within the supplied syllabus and official learning outcomes, and never introduce outside-syllabus facts. Spread the questions across the most important learning outcomes rather than clustering on one. " +
        "Do not use markdown or extra text.",
      userText: JSON.stringify({
        subject,
        chapterTitle,
        questionCount: cappedCount,
        difficulty,
        targetDifficulty: resolvedDifficulty.label,
        difficultyGuidance: resolvedDifficulty.instruction,
        mode,
        focusTopics,
        baseQuestions,
        existingQuestions,
        missingTopics: effectiveMissingTopics,
        coverageChecklist: effectiveCoverageChecklist,
        officialLearningOutcomes: effectiveOfficialLos,
        officialReadingTitle: effectiveOfficialTitle,
        aiSummary,
        chapter,
      }),
    });

    const structured = parseStructuredOutput(response.text);
    if (!structured?.practiceSet?.questions?.length) {
      return res.status(500).json({
        error: "The generated practice set was empty.",
        details: "AI returned no usable questions.",
      });
    }

    // Guarantee the difficulty the app stores matches what the user asked for,
    // regardless of what the model echoed back.
    structured.practiceSet.difficulty = resolvedDifficulty.label;
    structured.practiceSet.questions = structured.practiceSet.questions.map((question) => ({
      ...question,
      difficulty: resolvedDifficulty.label,
    }));

    res.json({
      ok: true,
      practiceSet: structured.practiceSet,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to generate practice set.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/analyze-practice-set", async (req, res) => {
  try {
    const {
      subject = "Unknown subject",
      generatedSet = null,
      generatedAnswers = {},
      parsedChapters = [],
      aiSummary = "",
    } = req.body || {};

    if (!generatedSet?.questions?.length) {
      return res.status(400).json({ error: "generatedSet is required." });
    }

    const answeredQuestions = generatedSet.questions
      .map((question) => {
        const selected = generatedAnswers?.[question.id] || "";
        const answer = String(question.answer || "");
        return {
          question: question.question,
          selected,
          correctAnswer: answer,
          correct: Boolean(selected && answer && String(selected).trim().toLowerCase() === answer.trim().toLowerCase()),
          explanation: question.explanation || "",
          tags: Array.isArray(question.tags) ? question.tags : [],
        };
      })
      .filter((question) => question.selected);

    const incorrect = answeredQuestions.filter((question) => !question.correct);

    const response = await runClaude({
      model: MODELS.analyze,
      maxTokens: 2048,
      forceJson: true,
      system:
        "You are creating a weak-topic review for a CFA Level I student after a chapter practice set. " +
        "Use the mistakes, chapter notes, revision focus, and answer patterns to produce a precise study plan. " +
        "Return strict JSON only with this shape: " +
        '{"review":{"summary":"","reviseTopics":[],"conceptExample":"","numericalExample":""}}. ' +
        "The summary should say exactly what to study next. " +
        "reviseTopics should be short exact concepts or formulas. " +
        "conceptExample should be a short plain-language teaching example. " +
        "numericalExample should be a short worked-style numerical example when useful, otherwise an empty string. Mention BA II Plus usage if it helps. " +
        "Base the advice on the actual mistakes. Do not use markdown.",
      userText: JSON.stringify({
        subject,
        chapterTitle: generatedSet.chapterTitle,
        difficulty: generatedSet.difficulty,
        aiSummary,
        parsedChapters,
        answeredQuestions,
        incorrect,
      }),
    });

    const structured = parseStructuredOutput(response.text);
    if (!structured?.review) {
      return res.status(500).json({
        error: "The review summary came back empty.",
        details: "AI returned no usable review summary.",
      });
    }

    res.json({
      ok: true,
      review: structured.review,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to analyze practice set.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`CFA Study Companion backend running on http://localhost:${port}`);
});
