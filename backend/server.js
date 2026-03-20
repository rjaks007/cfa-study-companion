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
          "Extract questions from the uploaded question bank. " +
          "If notes are present, use them to infer the most likely subject and reading/chapter mapping. " +
          "Return strict JSON with this shape: " +
          `{"subject":"", "chapters":[{"readingTitle":"","questions":[{"question":"","options":[],"answer":"","explanation":"","difficulty":"","tags":[]}]}]}. ` +
          "If answers are not available, leave answer as an empty string.",
      });

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
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

app.listen(port, () => {
  console.log(`CFA Study Companion backend running on http://localhost:${port}`);
});
