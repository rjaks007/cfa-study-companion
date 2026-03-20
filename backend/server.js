import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import pdf from "pdf-parse";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 8787);

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. AI routes will fail until you add it to backend/.env.");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function extractPdfText(buffer) {
  const result = await pdf(buffer);
  return String(result.text || "").replace(/\s+/g, " ").trim();
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

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cfa-study-companion-backend" });
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

      const notesText = notesFile ? await extractPdfText(notesFile.buffer) : "";
      const questionBankText = await extractPdfText(questionBankFile.buffer);

      const compactNotes = sampleTextAcrossDocument(notesText, 14000, 2);
      const compactQuestionBank = sampleTextAcrossDocument(questionBankText, 52000, 6);

      const response = await client.responses.create({
        model: "gpt-5.4-mini",
        max_output_tokens: 12000,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  `You are helping organize CFA Level I practice materials for ${subject}. ` +
                  "You will receive extracted text samples from a notes PDF and a question-bank PDF. " +
                  "Build a reliable chapter map from the material. Do not try to extract every raw question. " +
                  "Instead, identify likely chapters/readings, write a concise notes summary for each, list the exact concepts or formulas to revise, and include up to 5 representative source questions per chapter. " +
                  "Return strict JSON with this shape: " +
                  `{"subject":"", "chapters":[{"readingTitle":"","notesSummary":"","revisionFocus":[],"questions":[{"question":"","options":[],"answer":"","explanation":"","difficulty":"","tags":[]}]}]}. ` +
                  "Keep explanations to one short sentence max. Keep notesSummary dense and useful. If answers are not available, leave answer as an empty string. Do not use markdown.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify({
                  subject,
                  notesExcerpt: compactNotes,
                  questionBankExcerpt: compactQuestionBank,
                }),
              },
            ],
          },
        ],
      });

      res.json({
        ok: true,
        subject,
        model: "gpt-5.4-mini",
        output_text: response.output_text,
        raw: response,
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
    const { subject = "Unknown subject", question = "", parsedChapters = [], performanceSummary = null, aiSummary = "", extraContext = {} } = req.body || {};

    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: "question is required." });
    }

    const wantsVisual = /diagram|visual|image|draw|chart|timeline|map/i.test(String(question));

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a CFA Level I study assistant inside a personal study app. " +
                "Use the supplied notes summaries, parsed chapters, generated review, and performance summary to answer clearly, practically, and briefly. " +
                "Stay grounded in the supplied material. If the source is unclear, say what is uncertain instead of inventing. " +
                "Do not use markdown bullets, asterisks, or code fences. Write in clean short paragraphs. " +
                "If formulas are needed, write them as plain readable lines such as 'Future value = Present value × (1 + r)^n'. " +
                "When helpful, explain why the student's choice was wrong and what concept it confused. " +
                "End with a short 'Revise next:' line only when useful.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                subject,
                question,
                performanceSummary,
                aiSummary,
                parsedChapters,
                extraContext,
              }),
            },
          ],
        },
      ],
    });

    let imageUrl = "";
    if (wantsVisual) {
      try {
        const image = await client.images.generate({
          model: "gpt-image-1",
          size: "1024x1024",
          prompt:
            `Create a clean educational study visual for CFA Level I ${subject}. ` +
            `Focus on this request: ${question}. ` +
            "Use a simple academic style with labels and a plain background.",
        });

        const b64 = image.data?.[0]?.b64_json;
        if (b64) {
          imageUrl = `data:image/png;base64,${b64}`;
        }
      } catch (imageError) {
        console.warn("Image generation skipped", imageError);
      }
    }

    res.json({
      ok: true,
      answer: response.output_text,
      imageUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to answer study assistant question.",
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
      difficulty = "1",
      parsedChapters = [],
      aiSummary = "",
      mode = "standard",
      focusTopics = [],
      baseQuestions = [],
    } = req.body || {};

    if (!String(chapterTitle).trim()) {
      return res.status(400).json({ error: "chapterTitle is required." });
    }

    const cappedCount = Math.max(3, Math.min(40, Number(questionCount || 10)));
    const chapter = Array.isArray(parsedChapters)
      ? parsedChapters.find((item) => String(item?.readingTitle || "").trim() === String(chapterTitle).trim())
      : null;

    if (!chapter) {
      return res.status(400).json({ error: "Could not find that chapter in parsed material." });
    }

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You create CFA Level I chapter-wise practice sets from provided source material. " +
                "Generate fresh multiple-choice questions grounded in the supplied chapter notes, revision focus, and example questions. " +
                "Return strict JSON only with this shape: " +
                '{"practiceSet":{"chapterTitle":"","questionCount":0,"difficulty":"1","questions":[{"id":"","question":"","options":[],"answer":"","explanation":"","difficulty":"","tags":[]}]}}. ' +
                "Each question must have exactly four options, one correct answer copied exactly from the options array, and a short explanation. " +
                "Difficulty 1 means normal concept/application. Difficulty 2 means exam-style and moderately challenging. Difficulty 3 means hard, trap-aware, and computation-ready when appropriate. " +
                "Stay faithful to the supplied source and do not invent formulas or facts that are not supported by the material. " +
                "If mode is 'similar-questions', generate near-neighbor reinforcement questions around the supplied mistakes. " +
                "If mode is 'weak-topics-retry', focus heavily on the supplied focusTopics. " +
                "Do not use markdown or extra text.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                subject,
                chapterTitle,
                questionCount: cappedCount,
                difficulty,
                mode,
                focusTopics,
                baseQuestions,
                aiSummary,
                chapter,
              }),
            },
          ],
        },
      ],
    });

    const structured = parseStructuredOutput(response.output_text);
    if (!structured?.practiceSet?.questions?.length) {
      return res.status(500).json({
        error: "The generated practice set was empty.",
        details: "AI returned no usable questions.",
      });
    }

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

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are creating a weak-topic review for a CFA Level I student after a chapter practice set. " +
                "Use the mistakes, chapter notes, revision focus, and answer patterns to produce a precise study plan. " +
                "Return strict JSON only with this shape: " +
                '{"review":{"summary":"","reviseTopics":[],"conceptExample":"","numericalExample":""}}. ' +
                "The summary should say exactly what to study next. " +
                "reviseTopics should be short exact concepts or formulas. " +
                "conceptExample should be a short plain-language teaching example. " +
                "numericalExample should be a short worked-style numerical example when useful, otherwise an empty string. " +
                "Base the advice on the actual mistakes. Do not use markdown.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                subject,
                chapterTitle: generatedSet.chapterTitle,
                difficulty: generatedSet.difficulty,
                aiSummary,
                parsedChapters,
                answeredQuestions,
                incorrect,
              }),
            },
          ],
        },
      ],
    });

    const structured = parseStructuredOutput(response.output_text);
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
