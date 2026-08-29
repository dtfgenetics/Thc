import { questionOptions } from './engine.mjs';

export function informationScore(option) {
  const yes = Number(option?.yesCount ?? 0);
  const no = Number(option?.noCount ?? 0);
  const total = yes + no;
  if (!Number.isFinite(total) || total <= 0 || yes < 0 || no < 0) return 0;
  return Math.round((2 * Math.min(yes, no) / total) * 100);
}

export function rankedQuestionOptions(state, data) {
  const options = questionOptions(state, data).map((option) => ({
    ...option,
    informationScore: informationScore(option)
  }));

  options.sort((a, b) =>
    b.informationScore - a.informationScore ||
    Math.abs(a.yesCount - a.noCount) - Math.abs(b.yesCount - b.noCount) ||
    a.id.localeCompare(b.id)
  );

  return options.map((option, index) => ({
    ...option,
    bestSplit: index === 0 && option.informationScore > 0
  }));
}
