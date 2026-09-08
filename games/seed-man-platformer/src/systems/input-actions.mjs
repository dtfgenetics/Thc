export const INPUT_ACTIONS=Object.freeze(['move-left','move-right','jump','attack','phenotype','pause']);
export const DEFAULT_BINDINGS=Object.freeze({
  'move-left':['ArrowLeft','KeyA'],
  'move-right':['ArrowRight','KeyD'],
  jump:['Space','ArrowUp','KeyW'],
  attack:['KeyJ'],
  phenotype:['KeyK'],
  pause:['KeyP','Escape']
});
export function actionForCode(code){for(const [action,codes] of Object.entries(DEFAULT_BINDINGS))if(codes.includes(code))return action;return null;}
