// Challenge access is based on the subject textbook, not on the language or
// the student's current knowledge. Completed exercises remain open for review.
export function requiredChallengeBookLevel(lesson) {
  if (Number.isInteger(lesson?.firstProjectPart)) return 0;
  const difficulty = Number.isInteger(lesson?.difficulty) ? lesson.difficulty : 1;
  return Math.min(4, Math.max(0, difficulty - 2));
}

export function describeChallengeAccess(lesson, { ownedLevel = 0, hasMaterial = false, review = false, bookName = 'この分野の教本' } = {}) {
  const requiredLevel = requiredChallengeBookLevel(lesson);
  const bookId = `book-${lesson.subject}`;
  const available = hasMaterial && (review || ownedLevel >= requiredLevel);
  const reason = !hasMaterial ? 'この分野の無料教材を開いてください。'
    : available ? '' : `${bookName} Lv.${requiredLevel}で挑戦できます。現在 Lv.${ownedLevel}。`;
  return { available, requiredLevel, ownedLevel, bookId, bookName, reason, review };
}
