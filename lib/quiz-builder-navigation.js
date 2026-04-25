/**
 * @typedef {"all" | "needs-attention" | "warnings" | "ready"} QuestionSidebarFilter
 */

/**
 * @typedef {{
 *   id: string;
 *   index: number;
 *   text: string;
 *   isComplete: boolean;
 *   errorCount: number;
 *   warningCount: number;
 * }} QuestionNavigationEntry
 */

/**
 * @param {QuestionNavigationEntry} entry
 * @returns {Exclude<QuestionSidebarFilter, "all">}
 */
export function getQuestionSidebarStatus(entry) {
  if (entry.errorCount > 0) return "needs-attention";
  if (entry.warningCount > 0) return "warnings";
  return "ready";
}

/**
 * @param {QuestionNavigationEntry} entry
 * @param {string} query
 */
export function matchesQuestionSidebarQuery(entry, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const normalizedText = entry.text.trim().toLowerCase();
  return (
    normalizedText.includes(normalizedQuery) ||
    `question ${entry.index + 1}`.includes(normalizedQuery) ||
    `${entry.index + 1}` === normalizedQuery
  );
}

/**
 * @param {QuestionNavigationEntry[]} entries
 * @param {{ filter: QuestionSidebarFilter; query: string }} options
 */
export function buildQuestionNavigation(entries, options) {
  const counts = entries.reduce(
    (summary, entry) => {
      summary.all += 1;
      const status = getQuestionSidebarStatus(entry);
      if (status === "needs-attention") summary.needsAttention += 1;
      if (status === "warnings") summary.warnings += 1;
      if (status === "ready") summary.ready += 1;
      return summary;
    },
    { all: 0, needsAttention: 0, warnings: 0, ready: 0 },
  );

  const visible = entries.filter((entry) => {
    if (!matchesQuestionSidebarQuery(entry, options.query)) return false;
    if (options.filter === "all") return true;
    return getQuestionSidebarStatus(entry) === options.filter;
  });

  return { counts, visible };
}

/**
 * @param {number} currentIndex
 * @param {QuestionNavigationEntry[]} visible
 */
export function getNextVisibleQuestionIndex(currentIndex, visible) {
  if (visible.length === 0) return null;
  if (visible.some((entry) => entry.index === currentIndex)) return currentIndex;

  let closest = visible[0].index;
  let closestDistance = Math.abs(closest - currentIndex);

  for (const entry of visible.slice(1)) {
    const distance = Math.abs(entry.index - currentIndex);
    if (distance < closestDistance || (distance === closestDistance && entry.index < closest)) {
      closest = entry.index;
      closestDistance = distance;
    }
  }

  return closest;
}
