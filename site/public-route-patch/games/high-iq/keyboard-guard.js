import { shouldIgnoreQuizShortcutTarget } from './game-core.mjs';

const quizPanel = document.querySelector('#quiz-panel');

// Register before app-v3.js. Interactive elements such as verification-source
// links keep their native keyboard behavior instead of being consumed by the
// quiz-wide Enter shortcut.
document.addEventListener('keydown', (event) => {
  if (!quizPanel || quizPanel.hidden) return;
  if (!shouldIgnoreQuizShortcutTarget(document.activeElement)) return;
  event.stopImmediatePropagation();
});
