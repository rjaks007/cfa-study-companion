import { ChapterQuestionSummary, MistakeType, QuestionProgress, Reading, Subject } from "../types";

export function emptyQuestionProgress(): QuestionProgress {
  return {
    total: 0,
    correct: 0,
    wrong: 0,
    skipped: 0,
    byType: {
      concept: 0,
      formula: 0,
      application: 0,
      silly: 0,
      misread: 0,
    },
  };
}

export function generateMindMapTemplate(reading: Pick<Reading, "subject" | "readingNumber" | "title">) {
  return [
    `${reading.subject} -> Reading ${reading.readingNumber}: ${reading.title}`,
    "Core idea 1",
    "- Definition / intuition",
    "- Why it matters in CFA questions",
    "Core idea 2",
    "- Key distinction",
    "- Common trap",
    "Core idea 3",
    "- Formula or process",
    "- How to apply in a question",
    "Final connection",
    "- How this reading links to other topics",
  ].join("\n");
}

export function generateFormulaTemplate(reading: Pick<Reading, "title">) {
  return [
    `${reading.title} - Formula List`,
    "1. Formula name = ",
    "   When to use: ",
    "2. Formula name = ",
    "   When to use: ",
    "3. Formula name = ",
    "   When to use: ",
    "4. Common error to avoid: ",
  ].join("\n");
}

export function generateSummaryTemplate(reading: Pick<Reading, "title">) {
  return `${reading.title} focuses on the ideas, formulas, and question patterns most likely to be tested. Keep this summary tight and focused on what the chapter is really trying to teach.`;
}

export function generateMemoryTip(reading: Pick<Reading, "subject" | "title">) {
  const title = reading.title.toLowerCase();
  if (title.includes("time value")) return "Draw the timeline first. Once cash flows are placed correctly, most TVM questions become easier.";
  if (title.includes("hypothesis")) return "Work in order: null hypothesis, test statistic, critical rule, conclusion.";
  if (title.includes("regression")) return "Think in a chain: relationship -> slope -> fit -> prediction error.";
  if (title.includes("inventory")) return "In rising prices, remember the story first: FIFO leaves newer, more expensive inventory on the balance sheet.";
  if (title.includes("bond") || reading.subject === "Fixed Income") return "Anchor every bond question to cash flow timing, discount rate, and price direction.";
  if (reading.subject === "Ethics") return "Read the facts slowly, identify the standard, then eliminate answers that ignore duty.";
  return "Compress the reading into three anchors: concept, formula, and trap.";
}

export function generateExamTip(reading: Pick<Reading, "subject" | "title">) {
  const title = reading.title.toLowerCase();
  if (title.includes("return")) return "First decide whether the question wants holding period, annualized, money-weighted, or time-weighted return.";
  if (title.includes("time value")) return "Before calculating, identify PV, FV, rate, periods, and whether cash flows are ordinary or annuity due.";
  if (title.includes("hypothesis")) return "The final conclusion sentence is where many correct calculations still turn into wrong answers.";
  if (title.includes("cash flow")) return "Classify effects into operating, investing, and financing before looking at choices.";
  if (reading.subject === "Ethics") return "The most tempting wrong answers usually sound practical but violate independence, diligence, or disclosure.";
  return "Before solving, decide whether the question is mainly concept recognition, formula application, or answer-choice traps.";
}

export function deriveMistakeKey(mistakeType: MistakeType) {
  if (mistakeType === "Concept weak") return "concept";
  if (mistakeType === "Formula weak") return "formula";
  if (mistakeType === "Application weak") return "application";
  if (mistakeType === "Silly mistake") return "silly";
  if (mistakeType === "Misread question") return "misread";
  return null;
}

export function buildChapterQuestionSummary(reading: Pick<Reading, "id">, sessions: Array<{ readingId: string; sessionType: string; questions: number; correct: number; mistakeType: MistakeType }>): ChapterQuestionSummary {
  const chapterSessions = sessions.filter(
    (session) =>
      session.readingId === reading.id &&
      (session.sessionType === "Practice Questions" || session.sessionType === "Revision" || session.sessionType === "Mock"),
  );

  const totalQuestions = chapterSessions.reduce((sum, session) => sum + Number(session.questions || 0), 0);
  const totalCorrect = chapterSessions.reduce((sum, session) => sum + Number(session.correct || 0), 0);
  const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const counts: Record<MistakeType, number> = {
    "Concept weak": 0,
    "Formula weak": 0,
    "Application weak": 0,
    "Silly mistake": 0,
    "Misread question": 0,
    "No major issue": 0,
  };

  chapterSessions.forEach((session) => {
    if (counts[session.mistakeType] !== undefined) {
      counts[session.mistakeType] += Math.max(0, Number(session.questions || 0) - Number(session.correct || 0));
    }
  });

  const weakestEntry = Object.entries(counts)
    .filter(([key]) => key !== "No major issue")
    .sort((a, b) => b[1] - a[1])[0];

  return {
    totalQuestions,
    totalCorrect,
    accuracy,
    counts,
    weakestArea: weakestEntry && weakestEntry[1] > 0 ? (weakestEntry[0] as MistakeType) : "No major issue",
  };
}

export function generateFlashcardsFromReading(reading: Pick<Reading, "subject" | "readingNumber" | "title" | "summary" | "formulaSheet" | "memoryTip" | "examTip" | "id">) {
  const cards: Array<{ front: string; back: string; cardType: "Concept" | "Formula" | "Trap" }> = [];

  if (reading.summary.trim()) {
    cards.push({
      front: `What is the central idea of Reading ${reading.readingNumber}: ${reading.title}?`,
      back: reading.summary.trim(),
      cardType: "Concept",
    });
  }

  if (reading.formulaSheet.trim()) {
    cards.push({
      front: `What are the key formulas or procedures in ${reading.title}?`,
      back: reading.formulaSheet.trim(),
      cardType: "Formula",
    });
  }

  const trapText = [reading.memoryTip.trim(), reading.examTip.trim()].filter(Boolean).join("\n\n");
  if (trapText) {
    cards.push({
      front: `What trap or exam habit should you remember for ${reading.title}?`,
      back: trapText,
      cardType: "Trap",
    });
  }

  return cards.map((card, index) => ({
    ...card,
    idSeed: `${reading.id}_${index + 1}`,
    topic: reading.subject as Subject,
    readingId: reading.id,
    readingTitle: reading.title,
    deck: `${reading.subject.split(" ")[0]} Auto`,
  }));
}
