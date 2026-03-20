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
          "Extract as many usable questions as possible from the uploaded question bank, not just a small sample. Prioritize exhaustive extraction over long prose. Work through the full file and preserve coverage across chapters when possible. " +
          "If notes are present, use them to infer the most likely subject and reading/chapter mapping, and create a concise revision summary for each chapter. " +
          "Return strict JSON with this shape: " +
          `{"subject":"", "chapters":[{"readingTitle":"","notesSummary":"","revisionFocus":[],"questions":[{"question":"","options":[],"answer":"","explanation":"","difficulty":"","tags":[]}]}]}. ` +
          "The revisionFocus array should contain the exact concepts or formulas that deserve another study pass. " +
          "Keep explanations to one short sentence max so more questions fit in the response. " +
          "If answers are not available, leave answer as an empty string.",
      });

      const response = await client.responses.create({
        model: "gpt-4.1-mini",
        max_output_tokens: 30000,
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

    const wantsVisual = /diagram|visual|image|draw|chart|timeline|map/i.test(String(question));

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
                "Do not use markdown bullets, asterisks, or code fences. " +
                "Write in clean short paragraphs. " +
                "If formulas are needed, write them as plain readable lines such as 'Future value = Present value × (1 + r)^n'. " +
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

app.listen(port, () => {
  console.log(`CFA Study Companion backend running on http://localhost:${port}`);
});
