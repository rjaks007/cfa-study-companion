import { UploadRecord } from "../types";

export type TopicStatusValue = "solid" | "weak" | "untested";

export interface TopicStatus {
  topic: string;
  status: TopicStatusValue;
}

export interface TopicCoverage {
  topics: TopicStatus[];
  solid: number;
  total: number;
  percent: number;
  weakTopics: string[];
  untestedTopics: string[];
}

const EMPTY_COVERAGE: TopicCoverage = {
  topics: [],
  solid: 0,
  total: 0,
  percent: 0,
  weakTopics: [],
  untestedTopics: [],
};

function tokenize(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function attemptMatchesTopic(topic: string, haystack: string) {
  const topicTokens = tokenize(topic);
  if (!topicTokens.length) return false;
  const matched = topicTokens.filter((token) => haystack.includes(token));
  return matched.length >= Math.max(1, Math.ceil(topicTokens.length * 0.5));
}

// Builds a durable topic-mastery view for a chapter using the persistent coverage log.
// A topic is: solid (last matching attempt correct), weak (last attempt wrong), or untested.
export function buildTopicCoverage(upload: UploadRecord | undefined, chapterTitle: string): TopicCoverage {
  if (!upload) return EMPTY_COVERAGE;
  const chapter = upload.parsedChapters.find((item) => item.readingTitle === chapterTitle);
  if (!chapter) return EMPTY_COVERAGE;

  const primary = [...(chapter.losChecklist || []), ...(chapter.keySubtopics || [])]
    .map((item) => String(item).trim())
    .filter(Boolean);
  const fallback = (chapter.revisionFocus || []).map((item) => String(item).trim()).filter(Boolean);
  const topics = Array.from(new Set(primary.length ? primary : fallback)).slice(0, 24);

  if (!topics.length) return EMPTY_COVERAGE;

  const attempts = (upload.coverageLog || []).filter((attempt) => attempt.chapterTitle === chapterTitle);

  const statuses: TopicStatus[] = topics.map((topic) => {
    const matched = attempts.filter((attempt) => attemptMatchesTopic(topic, `${attempt.questionText} ${(attempt.tags || []).join(" ")}`.toLowerCase()));
    if (!matched.length) return { topic, status: "untested" };
    const latest = matched[matched.length - 1];
    return { topic, status: latest.correct ? "solid" : "weak" };
  });

  const solid = statuses.filter((entry) => entry.status === "solid").length;
  const total = statuses.length;

  return {
    topics: statuses,
    solid,
    total,
    percent: total ? Math.round((solid / total) * 100) : 0,
    weakTopics: statuses.filter((entry) => entry.status === "weak").map((entry) => entry.topic),
    untestedTopics: statuses.filter((entry) => entry.status === "untested").map((entry) => entry.topic),
  };
}
