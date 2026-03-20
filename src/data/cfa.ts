import { Flashcard, MockExam, Reading, SessionDraft, StoredState, Subject, UploadRecord, WeekPlan, CardDraft } from "../types";
import { makeId, todayISO } from "../utils/study";
import { emptyQuestionProgress } from "../utils/templates";

export const SUBJECT_ORDER: Subject[] = [
  "Quantitative Methods",
  "Financial Statement Analysis",
  "Fixed Income",
  "Derivatives",
  "Corporate Finance",
  "Equity Investments",
  "Portfolio Management",
  "Economics",
  "Alternative Investments",
  "Ethics",
];

export const SUBJECT_BLUEPRINT: Record<Subject, string[]> = {
  "Quantitative Methods": [
    "Rate and Return",
    "The Time Value of Money",
    "Statistical Measures of Asset Returns",
    "Probability Trees and Conditional Expectations",
    "Portfolio Mathematics",
    "Simulating Investment Outcomes",
    "Estimation and Inference",
    "Hypothesis Testing",
    "Big Data Techniques",
    "Introduction to Linear Regression",
    "Correlation Analysis",
  ],
  "Financial Statement Analysis": [
    "Introduction to Financial Statement Analysis",
    "Analyzing Income Statements",
    "Analyzing Balance Sheets",
    "Analyzing Cash Flow Statements I",
    "Analyzing Cash Flow Statements II",
    "Revenue Recognition",
    "Inventories",
    "Long-Lived Assets",
    "Income Taxes",
    "Non-Current Liabilities",
    "Financial Reporting Quality",
    "Financial Analysis Techniques",
  ],
  "Fixed Income": [
    "Fixed-Income Security Features",
    "Fixed-Income Markets",
    "Fixed-Income Pricing",
    "Yield Measures and Curves",
    "Introduction to Asset-Backed Securities",
    "Understanding Fixed-Income Risk and Return",
    "Fundamentals of Credit Analysis",
  ],
  "Derivatives": [
    "Derivative Instrument and Derivative Market Features",
    "Forward Commitment and Contingent Claim Features and Instruments",
    "Derivative Benefits, Risks, and Issuer and Investor Uses",
    "Pricing and Valuation of Forward Commitments",
    "Pricing and Valuation of Contingent Claims",
  ],
  "Corporate Finance": [
    "Corporate Structures and Ownership",
    "Capital Investments",
    "Cost of Capital",
    "Measures of Leverage",
    "Working Capital Management",
    "Business Models",
  ],
  "Equity Investments": [
    "Market Organization and Structure",
    "Security Market Indexes",
    "Market Efficiency",
    "Overview of Equity Securities",
    "Industry and Company Analysis",
    "Equity Valuation: Concepts and Basic Tools",
    "Company Analysis: Past and Present",
  ],
  "Portfolio Management": [
    "Portfolio Risk and Return: Part I",
    "Portfolio Risk and Return: Part II",
    "Basics of Portfolio Planning and Construction",
    "Capital Market Theory",
    "Measures of Risk-Adjusted Return",
    "Investment Policy Statement Basics",
  ],
  Economics: [
    "Demand and Supply Analysis",
    "The Firm and Market Structures",
    "Aggregate Output, Prices, and Economic Growth",
    "Understanding Business Cycles",
    "Monetary and Fiscal Policy",
    "International Trade",
    "Currency Exchange Rates",
    "Economic Growth and Development",
  ],
  "Alternative Investments": [
    "Alternative Investment Features, Methods, and Structures",
    "Real Estate and Infrastructure",
    "Hedge Funds",
    "Private Equity",
  ],
  Ethics: [
    "Ethics and Trust in the Investment Profession",
    "Code of Ethics and Standards of Professional Conduct",
    "Guidance for Standards I-VII",
    "Application of the Code and Standards: Level I",
  ],
};

export function buildReadings() {
  const readings: Reading[] = [];

  SUBJECT_ORDER.forEach((subject) => {
    SUBJECT_BLUEPRINT[subject].forEach((title, index) => {
      readings.push({
        id: `${subject}__${index + 1}`,
        subject,
        readingNumber: index + 1,
        title,
        weekAssigned: 1,
        status: "not-started",
        confidence: 0,
        lastReviewed: "",
        nextReview: "",
        sessionType: "Reading",
        notes: "",
        memoryMap: "",
        formulaSheet: "",
        summary: "",
        chapterSummary: "",
        memoryTip: "",
        examTip: "",
        weakTags: [],
        reviewHistory: [],
        accuracy: null,
        questionsSolved: 0,
        questionProgress: emptyQuestionProgress(),
        revisionCycle: 1,
        estimatedHours:
          subject === "Financial Statement Analysis"
            ? 4
            : subject === "Quantitative Methods" || subject === "Fixed Income"
              ? 3.5
              : 3,
      });
    });
  });

  let week = 1;
  let weekdaySlots = 5;
  let weekendCapacity = 8;

  readings.forEach((reading) => {
    const load = reading.estimatedHours;
    if (weekdaySlots <= 0 && weekendCapacity <= 0) {
      week += 1;
      weekdaySlots = 5;
      weekendCapacity = 8;
    }

    if (load <= 2.2 && weekdaySlots > 0) {
      reading.weekAssigned = week;
      weekdaySlots -= 1;
    } else if (weekdaySlots > 0 && weekendCapacity >= Math.max(2, Math.ceil(load))) {
      reading.weekAssigned = week;
      weekdaySlots -= 1;
      weekendCapacity -= Math.max(1, Math.ceil(load - 1));
    } else if (weekendCapacity >= Math.ceil(load)) {
      reading.weekAssigned = week;
      weekendCapacity -= Math.ceil(load);
    } else {
      week += 1;
      weekdaySlots = 5;
      weekendCapacity = 8;
      reading.weekAssigned = week;
      if (load <= 2.2) weekdaySlots -= 1;
      else weekendCapacity -= Math.ceil(load);
    }
  });

  return readings;
}

export function buildWeeks(readings: Reading[]) {
  const weeks: WeekPlan[] = Array.from({ length: 26 }, (_, index) => ({
    week: index + 1,
    readings: [],
    type: index < 16 ? "Coverage" : index < 21 ? "Revision" : "Mock & Final Review",
  }));

  readings.forEach((reading) => {
    const position = Math.min(25, Math.max(0, reading.weekAssigned - 1));
    weeks[position].readings.push(reading.id);
  });

  weeks[16].revisionFocus = ["Quantitative Methods", "Financial Statement Analysis"];
  weeks[17].revisionFocus = ["Fixed Income", "Derivatives"];
  weeks[18].revisionFocus = ["Corporate Finance", "Equity Investments"];
  weeks[19].revisionFocus = ["Portfolio Management", "Economics"];
  weeks[20].revisionFocus = ["Alternative Investments", "Ethics"];
  weeks[21].revisionFocus = ["Mock Exam 1", "Weak Areas Review"];
  weeks[22].revisionFocus = ["Mock Exam 2", "Weak Areas Review"];
  weeks[23].revisionFocus = ["Mock Exam 3", "Formula Revision"];
  weeks[24].revisionFocus = ["Ethics Final Revision", "High-Yield Questions"];
  weeks[25].revisionFocus = ["Final Review", "Rest + Light Revision"];

  return weeks;
}

export function defaultUploads() {
  return SUBJECT_ORDER.map<UploadRecord>((subject) => ({
    subject,
    notesPdfName: "",
    notesPdfUri: "",
    questionBankPdfName: "",
    questionBankPdfUri: "",
    notesParsed: false,
    questionBankParsed: false,
    lastSyncAt: "",
    uploadStatus: "Not uploaded",
    chaptersDetected: 0,
    readyForReview: false,
    aiSummary: "",
    aiError: "",
    parsedChapters: [],
    userAnswers: {},
  }));
}

export function starterCards(): Flashcard[] {
  return [
    {
      id: makeId("card"),
      deck: "Quant",
      topic: "Quantitative Methods",
      readingId: "Quantitative Methods__2",
      readingTitle: "The Time Value of Money",
      front: "What is the future value formula?",
      back: "FV = PV(1 + r)^n",
      difficulty: 3,
      lastReviewed: "",
      nextReview: todayISO(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      status: "new",
      cardType: "Formula",
      suspended: false,
    },
    {
      id: makeId("card"),
      deck: "FSA",
      topic: "Financial Statement Analysis",
      readingId: "Financial Statement Analysis__7",
      readingTitle: "Inventories",
      front: "Under FIFO in rising prices, which inventory value is higher?",
      back: "Ending inventory is higher under FIFO than under LIFO.",
      difficulty: 3,
      lastReviewed: "",
      nextReview: todayISO(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      status: "new",
      cardType: "Application",
      suspended: false,
    },
  ];
}

export function defaultMocks(): MockExam[] {
  return [
    { id: makeId("mock"), name: "Mock 1", date: "", score: "", weakAreas: "", notes: "" },
    { id: makeId("mock"), name: "Mock 2", date: "", score: "", weakAreas: "", notes: "" },
    { id: makeId("mock"), name: "Mock 3", date: "", score: "", weakAreas: "", notes: "" },
  ];
}

export function createInitialState(): StoredState {
  const readings = buildReadings();
  return {
    startDate: todayISO(),
    readings,
    weeks: buildWeeks(readings),
    sessions: [],
    cards: starterCards(),
    uploads: defaultUploads(),
    mocks: defaultMocks(),
    selectedSubject: SUBJECT_ORDER[0],
    selectedReadingId: readings[0].id,
    backendBaseUrl: "http://localhost:8787",
    notificationsEnabled: false,
  };
}

export function createSessionDraft(subject: Subject, readingId: string): SessionDraft {
  return {
    date: todayISO(),
    subject,
    readingId,
    sessionType: "Reading",
    hours: "2",
    questions: "20",
    correct: "15",
    confidence: "6",
    mistakeType: "Concept weak",
    notes: "",
  };
}

export function createCardDraft(subject: Subject, readingId: string): CardDraft {
  return {
    deck: "General",
    topic: subject,
    readingId,
    front: "",
    back: "",
    difficulty: "3",
    cardType: "Concept",
  };
}
