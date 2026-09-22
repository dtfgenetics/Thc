export const INPUT_ACTIONS=Object.freeze(['move-left','move-right','jump','attack','phenotype','pause']);
export const DEFAULT_BINDINGS=Object.freeze({
  'move-left':['ArrowLeft','KeyA'],
  'move-right':['ArrowRight','KeyD'],
  jump:['Space','ArrowUp','KeyW'],
  attack:['KeyJ','KeyX'],
  phenotype:['KeyK','KeyC'],
  pause:['KeyP','Escape']
});
export const GAMEPAD_DEADZONE=0.22;
export const GAMEPAD_BINDINGS=Object.freeze({
  moveAxis:0,
  moveLeftButton:14,
  moveRightButton:15,
  jumpButton:0,
  phenotypeButton:1,
  attackButton:2,
  pauseButton:9
});
export function actionForCode(code){for(const [action,codes] of Object.entries(DEFAULT_BINDINGS))if(codes.includes(code))return action;return null;}
