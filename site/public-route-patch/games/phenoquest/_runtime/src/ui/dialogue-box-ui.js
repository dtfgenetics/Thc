import { getCurrentDialogueLine, getDialogueChoices, hasDialogueChoices } from '../engine/dialogue-runner.js';

export function renderDialogueBox({ container, session, onNext, onClose, onChoice }) {
  if (!container) return;

  if (!session?.active || !session.record) {
    container.innerHTML = '';
    return;
  }

  const line = getCurrentDialogueLine(session);
  const showChoices = hasDialogueChoices(session) || session.awaitingChoice;
  const choices = showChoices ? getDialogueChoices(session) : [];
  const isLastLine = session.lineIndex >= (session.record.lines?.length ?? 1) - 1 && !session.record.next && !choices.length;

  const choiceButtons = choices.map((choice) => `
    <button type="button" data-choice-id="${choice.id}">${choice.label}</button>
  `).join('');

  container.innerHTML = `
    <section class="dialogue-box result-card">
      <strong>${session.record.speaker}</strong>
      <p>${line ?? ''}</p>
      ${choices.length ? `<div class="action-row">${choiceButtons}</div>` : `<button type="button" id="dialogue-next-button">${isLastLine ? 'Close' : 'Next'}</button>`}
    </section>
  `;

  container.querySelector('#dialogue-next-button')?.addEventListener('click', () => {
    if (isLastLine) onClose?.();
    else onNext?.();
  });

  container.querySelectorAll('[data-choice-id]').forEach((button) => {
    button.addEventListener('click', () => onChoice?.(button.dataset.choiceId));
  });
}
