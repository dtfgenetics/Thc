# High Land audio

The game uses file-backed audio only. Browser playback starts after a player
interaction and the in-game mute control applies to music and effects.

Sources:

- `background-loop.mp3`: "Once Upon a Time (loop)" by TAD, CC0, from
  https://opengameart.org/content/once-upon-a-time-loop
- `dice-roll.mp3`, `card-draw.mp3`, and `move-tick.mp3`: selected from Kenney
  Casino Audio 1.1, CC0, from https://kenney.nl/assets/casino-audio
- `win.mp3`: "Medieval: Victory Theme" by RandomMind, CC0, from
  https://opengameart.org/content/medieval-victory-theme

The Kenney source OGG files were transcoded to MP3 for the required public file
contract; no oscillator tones are used at runtime.
