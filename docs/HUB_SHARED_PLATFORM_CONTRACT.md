# Shared Game Hub Platform Contract

The DTF game hub shares platform capabilities, not one universal gameplay engine.

## Shared capabilities

Every released game must integrate with these platform concepts:

- stable game slug and metadata
- public game detail route
- play route or external launch URL
- health status
- guest-first player entry
- optional registered-account link
- invite/deep-link format when multiplayer applies
- return-to-hub navigation
- age/audience notice where required
- privacy and moderation links
- consistent error and maintenance states
- release version and support information

## Game manifest

Each game should expose a checked-in manifest:

```ts
export type GameManifest = {
  slug: string;
  title: string;
  shortDescription: string;
  status: 'playable' | 'beta' | 'in_development' | 'concept';
  genre: string;
  minPlayers: number;
  maxPlayers: number;
  modes: Array<'single_player' | 'local_multiplayer' | 'online_multiplayer' | 'spectator'>;
  launch: {
    kind: 'internal_route' | 'external_url';
    value: string;
  };
  healthUrl?: string;
  repository: string;
  releaseVersion?: string;
};
```

The hub catalog must be generated from manifests rather than duplicated hard-coded cards.

## Integration types

### Embedded game module

Use when the game lives in the same repository and runtime as the hub. High Land can move toward this model after the authoritative service is stable.

### Separate application

Use when a game has a mature independent stack or realtime server. Kush Kings Chess and THC U Know should remain separate applications and launch from the hub through stable HTTPS URLs.

### Development listing

Use for projects that have approved public art or progress information but are not playable. The CTA must say `In Development`, not `Play`.

## Identity bridge

The first release may use per-game guest sessions. A later shared account service should issue short-lived, signed launch tokens containing only:

- platform user ID
- display name
- avatar reference
- issued-at time
- expiration time
- intended game slug

Games must validate the audience/game slug and expiration server-side. Do not pass reusable account credentials in query strings.

## Hub route plan

```text
/
/games
/games/high-land
/games/high-land/play
/games/kush-kings-chess
/games/thc-u-know
/games/who-took-it
/status
/help
/privacy
```

Games that remain separate applications should still have a hub detail route before launching externally.

## Operational contract

Every online game must provide:

- a health endpoint
- structured server logs
- explicit environment-variable documentation
- staging and production deployment records
- rollback instructions
- versioned database migrations where persistence exists
- automated rules tests
- at least one two-session browser test

## Release-state truthfulness

The hub must not label a design document, asset repository or untested prototype as a playable game. Status comes from verified deployment evidence, not repository existence.
