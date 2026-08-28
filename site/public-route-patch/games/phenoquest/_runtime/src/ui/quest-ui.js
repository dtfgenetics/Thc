export function renderQuestPanel({ container, quests }) {
  if (!container) return;

  const activeQuest = quests?.activeQuest ?? 'none';
  const completed = quests?.completed ?? [];
  const flags = quests?.flags ?? {};

  container.innerHTML = `
    <section class="quest-panel result-card">
      <strong>Current Objective</strong>
      <span>${activeQuest}</span>
      <span>Completed: ${completed.length}</span>
      <span>Flags: ${Object.keys(flags).length}</span>
    </section>
  `;
}
