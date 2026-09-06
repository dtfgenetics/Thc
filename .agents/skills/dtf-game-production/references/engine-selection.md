# DTF Game Engine Selection

Use this matrix before introducing or migrating a runtime.

| Game profile | Preferred runtime | Why | Avoid when |
| --- | --- | --- | --- |
| Crossword, trivia, card, board, puzzle, turn-based UI game | Existing web stack or Phaser | Small payload, fast load, mobile-friendly, simple deployment to dtfseeds.com | Do not move to Unity/Unreal for presentation alone |
| 2D platformer, arcade, top-down action | Phaser | Strong browser-native 2D workflow, deterministic scene/input structure | Avoid if the project is already healthy in another established 2D engine |
| Lightweight browser 3D | Three.js | Direct control, small web-oriented stack, GLB/glTF friendly | Avoid for very large editor-driven worlds if tooling cost dominates |
| React-hosted browser 3D | React Three Fiber | Best fit when React already owns app state/UI | Avoid if React is not part of the host application |
| Cross-platform 2D/3D with editor-driven systems | Unity | Mature animation, physics, scene tooling, broad platform targeting | Avoid for tiny UI-first browser games or when WebGL size is unacceptable |
| High-fidelity 3D/FPS/RPG/cinematic project | Unreal Engine | Advanced world, animation, lighting, VFX, AI and cinematic tools | Avoid for lightweight dtfseeds.com mini-games |

## Decision test

Before migrating an existing game, answer all six questions:

1. What concrete production problem cannot be solved reasonably in the current runtime?
2. What player-visible improvement will the migration create?
3. How will load size/startup time change?
4. How will dtfseeds.com delivery work after migration?
5. What happens to existing saves/content/tests/assets?
6. Is the migration cheaper and safer than repairing the current implementation?

If these answers are weak, do not migrate.

## DTFSeeds default routing

- Board/card/puzzle/trivia: browser-first.
- 2D action/platformer: Phaser-first.
- Browser 3D: Three.js/R3F-first.
- Expanded cross-platform game: evaluate Unity.
- High-fidelity first/third-person game: evaluate Unreal.

Blender is an asset/animation authoring tool and can feed any of these 3D targets; it is not itself the gameplay runtime.
