export const CASE_CODE_LENGTH = 6;
export const CASE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const STANDARD_QUESTIONS = 8;
export const STANDARD_GUESSES = 3;

export const WILD_MODIFIERS = Object.freeze([
  {
    id: 'foggy-jar',
    label: 'Foggy Jar',
    description: 'One question returns UNKNOWN and does not narrow the candidate list.',
    maxQuestions: 8,
    guesses: 3
  },
  {
    id: 'extra-sniff',
    label: 'Extra Sniff',
    description: 'You get one additional yes/no question.',
    maxQuestions: 9,
    guesses: 3
  },
  {
    id: 'risky-read',
    label: 'Risky Read',
    description: 'You get one fewer question, but one extra guess.',
    maxQuestions: 7,
    guesses: 4
  }
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function normalizeCaseCode(value) {
  const allowed = new Set(CASE_ALPHABET);
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .split('')
    .filter((character) => allowed.has(character))
    .join('')
    .slice(0, CASE_CODE_LENGTH);
}

export function isValidCaseCode(value) {
  return normalizeCaseCode(value).length === CASE_CODE_LENGTH;
}

function strainMap(data) {
  return new Map(data.strains.map((strain) => [strain.id, strain]));
}

function questionMap(data) {
  return new Map(data.questions.map((question) => [question.id, question]));
}

function modifierFor(code, wild) {
  if (!wild) return null;
  return WILD_MODIFIERS[hash(`${code}:modifier`) % WILD_MODIFIERS.length];
}

function configFor(modifier) {
  return {
    maxQuestions: modifier?.maxQuestions ?? STANDARD_QUESTIONS,
    guesses: modifier?.guesses ?? STANDARD_GUESSES
  };
}

export function createGame({ code, wild = false } = {}, data) {
  if (!data?.strains?.length || !data?.questions?.length) throw new Error('Mystery Strain data is required.');
  const normalized = normalizeCaseCode(code);
  if (!isValidCaseCode(normalized)) throw new Error('A six-character case code is required.');

  const secret = data.strains[hash(`${normalized}:secret`) % data.strains.length];
  const modifier = modifierFor(normalized, Boolean(wild));
  const config = configFor(modifier);
  const fogQuestionIndex = modifier?.id === 'foggy-jar'
    ? hash(`${normalized}:fog`) % config.maxQuestions
    : null;

  return {
    schemaVersion: 1,
    code: normalized,
    wild: Boolean(wild),
    modifier: modifier ? clone(modifier) : null,
    fogQuestionIndex,
    secretId: secret.id,
    candidates: data.strains.map((strain) => strain.id),
    questionsAsked: [],
    clues: [],
    maxQuestions: config.maxQuestions,
    guessesLeft: config.guesses,
    initialGuesses: config.guesses,
    wrongGuesses: [],
    status: 'playing'
  };
}

export function questionOptions(state, data) {
  if (state.status !== 'playing') return [];
  const strains = strainMap(data);
  return data.questions
    .filter((question) => !state.questionsAsked.includes(question.id))
    .map((question) => {
      const yes = state.candidates.filter((id) => strains.get(id)?.traits.includes(question.id)).length;
      return {
        ...question,
        yesCount: yes,
        noCount: state.candidates.length - yes,
        informative: yes > 0 && yes < state.candidates.length
      };
    })
    .filter((question) => question.informative);
}

export function askQuestion(inputState, questionId, data) {
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('This mystery is already complete.');
  if (state.questionsAsked.length >= state.maxQuestions) throw new Error('No questions remain. Make a guess.');
  if (state.questionsAsked.includes(questionId)) throw new Error('That question was already used.');

  const questions = questionMap(data);
  const question = questions.get(questionId);
  if (!question) throw new Error(`Unknown question: ${questionId}`);
  if (!questionOptions(state, data).some((option) => option.id === questionId)) {
    throw new Error('That question no longer separates the remaining candidates.');
  }

  const strains = strainMap(data);
  const secret = strains.get(state.secretId);
  const questionIndex = state.questionsAsked.length;
  const fogged = state.modifier?.id === 'foggy-jar' && state.fogQuestionIndex === questionIndex;
  let answer = 'unknown';

  state.questionsAsked.push(questionId);
  if (!fogged) {
    const secretHasTrait = secret.traits.includes(questionId);
    answer = secretHasTrait ? 'yes' : 'no';
    state.candidates = state.candidates.filter((id) => {
      const hasTrait = strains.get(id)?.traits.includes(questionId);
      return secretHasTrait ? hasTrait : !hasTrait;
    });
  }

  state.clues.push({
    questionId,
    prompt: question.prompt,
    answer,
    remaining: state.candidates.length
  });

  return state;
}

export function guessStrain(inputState, strainId, data) {
  const state = clone(inputState);
  if (state.status !== 'playing') throw new Error('This mystery is already complete.');
  if (!state.candidates.includes(strainId)) throw new Error('That cultivar has already been eliminated.');

  if (strainId === state.secretId) {
    state.status = 'won';
    return state;
  }

  state.guessesLeft -= 1;
  state.wrongGuesses.push(strainId);
  state.candidates = state.candidates.filter((id) => id !== strainId);
  if (state.guessesLeft <= 0) state.status = 'lost';
  return state;
}

export function questionsLeft(state) {
  return Math.max(0, state.maxQuestions - state.questionsAsked.length);
}

export function gameScore(state) {
  if (state.status !== 'won') return null;
  const guessesUsed = state.initialGuesses - state.guessesLeft;
  return state.questionsAsked.length + guessesUsed * 2;
}
