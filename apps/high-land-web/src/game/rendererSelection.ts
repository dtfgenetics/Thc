export type MatchMediaLike = (query: string) => { matches: boolean };

export function shouldUseHighLandCanvasRenderer(matchMedia: MatchMediaLike = window.matchMedia.bind(window)): boolean {
  return matchMedia('(max-width: 720px)').matches;
}
