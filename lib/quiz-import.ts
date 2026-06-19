import {
  uid,
  type Question,
} from "@/lib/shared";

const TIME_OPTIONS = [10, 20, 30, 60];
const POINT_OPTIONS = [500, 1000, 2000];

function normalizeTimeLimit(value: number) {
  return TIME_OPTIONS.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best
  );
}

function normalizePoints(value: number) {
  return POINT_OPTIONS.reduce((best, current) =>
    Math.abs(current - value) < Math.abs(best - value) ? current : best
  );
}

function buildQuestion(
  text: string,
  answers: Array<{ text: string; isCorrect: boolean }>,
  timeLimit = 20,
  points = 1000
): Question {
  const paddedAnswers = [...answers];

  while (paddedAnswers.length < 4) {
    paddedAnswers.push({ text: "", isCorrect: false });
  }

  return {
    id: uid(),
    text: text.trim(),
    timeLimit: normalizeTimeLimit(timeLimit),
    points: normalizePoints(points),
    answers: paddedAnswers.slice(0, 4).map((answer) => ({
      id: uid(),
      text: answer.text.trim(),
      isCorrect: answer.isCorrect,
    })),
  };
}

function splitBlocks(raw: string) {
  return raw
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseMarkerQuestions(raw: string) {
  const blocks = splitBlocks(raw);

  if (blocks.length === 0) {
    return { matched: false, error: "Paste at least one question block.", questions: [] as Question[] };
  }

  const parsedQuestions: Question[] = [];
  let matchedAnyMarkers = false;

  for (const [index, block] of blocks.entries()) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const questionText = lines[0] ?? "";
    if (!questionText) {
      return {
        matched: true,
        error: `Question block ${index + 1} is missing a question line.`,
        questions: [] as Question[],
      };
    }

    const importedAnswers: Array<{ text: string; isCorrect: boolean }> = [];
    let timeLimit = 20;
    let points = 1000;

    for (const line of lines.slice(1)) {
      const timeMatch = line.match(/^(?:time|timer)\s*:\s*(\d+)/i);
      if (timeMatch) {
        timeLimit = Number(timeMatch[1]);
        continue;
      }

      const pointsMatch = line.match(/^points?\s*:\s*(\d+)/i);
      if (pointsMatch) {
        points = Number(pointsMatch[1]);
        continue;
      }

      if (/^[*-]\s+/.test(line)) {
        matchedAnyMarkers = true;
        importedAnswers.push({
          text: line.slice(1).trim(),
          isCorrect: line.startsWith("*"),
        });
        continue;
      }

      return {
        matched: matchedAnyMarkers,
        error: `Question block ${index + 1} has an invalid line: "${line}". Answers must start with * or -.`,
        questions: [] as Question[],
      };
    }

    if (importedAnswers.length === 0) {
      continue;
    }

    if (importedAnswers.length < 2) {
      return {
        matched: true,
        error: `Question block ${index + 1} needs at least two answers.`,
        questions: [] as Question[],
      };
    }

    if (importedAnswers.length > 4) {
      return {
        matched: true,
        error: `Question block ${index + 1} has more than four answers. Trim it down before importing.`,
        questions: [] as Question[],
      };
    }

    const correctCount = importedAnswers.filter((answer) => answer.isCorrect).length;
    if (correctCount !== 1) {
      return {
        matched: true,
        error: `Question block ${index + 1} must have exactly one correct answer marked with *.`,
        questions: [] as Question[],
      };
    }

    parsedQuestions.push(buildQuestion(questionText, importedAnswers, timeLimit, points));
  }

  return {
    matched: matchedAnyMarkers,
    error: "",
    questions: parsedQuestions,
  };
}

function cleanQuestionPrefix(value: string) {
  return value
    .replace(/^question\s*\d*\s*[:.)-]?\s*/i, "")
    .replace(/^q\s*\d*\s*[:.)-]?\s*/i, "")
    .trim();
}

function parseChoiceQuestions(raw: string) {
  const blocks = splitBlocks(raw);
  if (blocks.length === 0) {
    return { matched: false, error: "Paste at least one question block.", questions: [] as Question[] };
  }

  const parsedQuestions: Question[] = [];
  let matchedChoiceFormat = false;

  for (const [index, block] of blocks.entries()) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 3) {
      continue;
    }

    let questionText = "";
    const choices = new Map<string, string>();
    let answerRef = "";
    let timeLimit = 20;
    let points = 1000;

    for (const line of lines) {
      const timeMatch = line.match(/^(?:time|timer)\s*:\s*(\d+)/i);
      if (timeMatch) {
        timeLimit = Number(timeMatch[1]);
        continue;
      }

      const pointsMatch = line.match(/^points?\s*:\s*(\d+)/i);
      if (pointsMatch) {
        points = Number(pointsMatch[1]);
        continue;
      }

      const answerMatch = line.match(/^(?:answer|correct)\s*:\s*(.+)$/i);
      if (answerMatch) {
        answerRef = answerMatch[1].trim();
        matchedChoiceFormat = true;
        continue;
      }

      const choiceMatch = line.match(/^([A-D])[\).:-]\s+(.+)$/i);
      if (choiceMatch) {
        choices.set(choiceMatch[1].toUpperCase(), choiceMatch[2].trim());
        matchedChoiceFormat = true;
        continue;
      }

      if (!questionText) {
        questionText = cleanQuestionPrefix(line);
      }
    }

    if (!matchedChoiceFormat) {
      continue;
    }

    if (!questionText) {
      return {
        matched: true,
        error: `Question block ${index + 1} is missing question text.`,
        questions: [] as Question[],
      };
    }

    if (choices.size < 2) {
      return {
        matched: true,
        error: `Question block ${index + 1} needs at least two answer choices.`,
        questions: [] as Question[],
      };
    }

    const normalizedAnswerRef = answerRef.trim().toUpperCase();
    const answers = [...choices.entries()].map(([label, text]) => ({
      text,
      isCorrect:
        normalizedAnswerRef === label ||
        answerRef.trim().toLowerCase() === text.trim().toLowerCase(),
    }));

    const correctCount = answers.filter((answer) => answer.isCorrect).length;
    if (correctCount !== 1) {
      return {
        matched: true,
        error: `Question block ${index + 1} must include a single correct answer via "Answer: A" or "Correct: full answer text".`,
        questions: [] as Question[],
      };
    }

    parsedQuestions.push(buildQuestion(questionText, answers, timeLimit, points));
  }

  return {
    matched: matchedChoiceFormat,
    error: "",
    questions: parsedQuestions,
  };
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'");
}

export function extractReadableTextFromHtml(raw: string) {
  return decodeHtmlEntities(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

export function extractTitleFromHtml(raw: string) {
  const match = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeHtmlEntities(match[1]).replace(/\s+/g, " ").trim();
}

export function parseImportedQuestions(raw: string) {
  const markerResult = parseMarkerQuestions(raw);
  if (markerResult.matched) {
    return markerResult;
  }

  const choiceResult = parseChoiceQuestions(raw);
  if (choiceResult.matched) {
    return choiceResult;
  }

  return {
    error:
      "Could not detect a quiz structure. Use either * / - answer markers, or multiple-choice blocks with A./B./C./D. and an Answer: line.",
    questions: [] as Question[],
  };
}
