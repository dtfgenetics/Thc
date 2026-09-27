type HighLandHowlOptions = {
  src: string[];
  volume?: number;
  loop?: boolean;
  preload?: boolean;
  html5?: boolean;
  onloaderror?: (id: number | null, error: unknown) => void;
  onplayerror?: (id: number, error: unknown) => void;
  onend?: (id: number) => void;
};

type HighLandHowl = {
  play(spriteOrId?: string | number): number;
  pause(id?: number): HighLandHowl;
  stop(id?: number): HighLandHowl;
  mute(muted?: boolean, id?: number): boolean | HighLandHowl;
  volume(volume?: number, id?: number): number | HighLandHowl;
  playing(id?: number): boolean;
  unload(): void;
};

declare global {
  interface Window {
    Howl?: new (options: HighLandHowlOptions) => HighLandHowl;
    Howler?: {
      mute(muted: boolean): void;
      volume(volume?: number): number | void;
    };
  }
}

export {};
