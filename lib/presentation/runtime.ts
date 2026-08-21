export function shouldShowPresentationResults(resultsHidden: boolean) {
  return !resultsHidden;
}

export function activityMatchesSlide(
  currentSlideId: string | undefined,
  activity: { slide_id?: string }
) {
  return Boolean(currentSlideId && activity.slide_id === currentSlideId);
}

export function normalizePresentationActivity(body: Record<string, unknown>, presenter: boolean) {
  const responses = presenter && Array.isArray(body.responses) ? body.responses : [];
  return {
    responses,
    responseCount: typeof body.response_count === "number" ? body.response_count : responses.length,
    ownResponse: body.own_response ?? null,
    aggregates: body.aggregates && typeof body.aggregates === "object"
      ? body.aggregates as Record<string, unknown>
      : {},
    questions: Array.isArray(body.questions) ? body.questions : [],
  };
}

export function summarizePresentationActivity(
  slide: { content?: { options?: Array<{ id: string }> } },
  responses: Array<{ response_data?: Record<string, unknown> }>,
) {
  const wordCounts: Record<string, number> = {};
  for (const response of responses) {
    const words = String(response.response_data?.words || "").split(/[\s,]+/).filter((word) => word.length > 1);
    for (const word of words) wordCounts[word.toLowerCase()] = (wordCounts[word.toLowerCase()] || 0) + 1;
  }

  const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 30);
  const pollCounts: Record<string, number> = {};
  for (const option of slide.content?.options || []) pollCounts[option.id] = 0;
  for (const response of responses) {
    const optionId = response.response_data?.option_id;
    if (typeof optionId === "string") pollCounts[optionId] = (pollCounts[optionId] || 0) + 1;
  }

  const scaleValues = responses.map((response) => Number(response.response_data?.value) || 0);
  const scaleAvg = scaleValues.length
    ? Math.round(scaleValues.reduce((sum, value) => sum + value, 0) / scaleValues.length * 10) / 10
    : 0;

  return { sortedWords, pollCounts, scaleValues, scaleAvg };
}
