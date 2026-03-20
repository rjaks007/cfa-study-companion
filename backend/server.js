import "dotenv/config";
import cors from "cors";
import express from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 8787);

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. AI routes will fail until you add it to backend/.env.");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

      const inputContent = [];

      if (notesFile) {
        const uploadedNotes = await client.files.create({
          file: await toFile(notesFile.buffer, notesFile.originalname, { type: notesFile.mimetype }),
          purpose: "user_data",
        });
        inputContent.push({
          type: "input_file",
          file_id: uploadedNotes.id,
        });
      }

      const uploadedQuestionBank = await client.files.create({
        file: await toFile(questionBankFile.buffer, questionBankFile.originalname, { type: questionBankFile.mimetype }),
        purpose: "user_data",
      });

      inputContent.push({
        type: "input_file",
        file_id: uploadedQuestionBank.id,
      });

      inputContent.push({
        type: "input_text",
        text:
          `You are helping organize CFA Level I practice materials for ${subject}. ` +
          "Extract as many usable questions as possible from the uploaded question bank, not just a small sample. Work through the full file and preserve coverage across chapters when possible. " +
          "If notes are present, use them to infer the most likely subject and reading/chapter mapping, and create a concise revision summary for each chapter. " +
          "Return strict JSON with this shape: " +
          `{"subject":"", "chapters":[{"readingTitle":"","notesSummary":"","revisionFocus":[],"questions":[{"question":"","options":[],"answer":"","explanation":"","difficulty":"","tags":[]}]}]}. ` +
          "The revisionFocus array should contain the exact concepts or formulas that deserve another study pass. " +
          "If answers are not available, leave answer as an empty string.",
      });

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        max_output_tokens: 20000,
        input: [
          {
            role: "user",
            content: inputContent,
          },
        ],
      });

      res.json({
        ok: true,
        subject,
        model: "gpt-4.1-mini",
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

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a CFA Level I study assistant inside a personal study app. " +
                "Use the supplied notes summaries, parsed chapters, and performance summary to answer clearly, practically, and briefly. " +
                "When useful, end with a short bullet list of what to revise next.",
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

    res.json({
      ok: true,
      answer: response.output_text,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to answer study assistant question.",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`CFA Study Companion backend running on http://localhost:${port}`);
});
