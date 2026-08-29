# Harvest Hustle

Production target: **dtfseeds.com**

Harvest Hustle is a fast browser time-management game built around an abstract harvest-room shift. Players route fictional batches through simple game stations under a countdown, protect quality, build combos, and avoid wasting actions.

## First playable vertical slice

- deterministic six-character shift codes;
- a fixed-length arcade shift with a visible countdown;
- a queue of fictional batches with different values, patience, and station sequences;
- four abstract game stations: Tag, Trim, Rack, and Pack;
- correct station actions advance a batch and build combo;
- wrong-station actions cost time and quality and break combo;
- expired batches lose quality rather than teaching real-world processing rules;
- scoring based on completed batches, remaining quality, combo, and time;
- responsive keyboard/mobile-safe DOM controls and reduced-motion support;
- canonical data/engine synchronized with the self-hosted public runtime.

## Content boundary

The station names are stylized game mechanics. Harvest Hustle does not provide real-world processing instructions, drying targets, chemical directions, equipment settings, or consumption guidance.

## Current status

`browser-vertical-slice`. Rules testing, browser/mobile playtesting, accessibility review, deployment registration, and production release remain separate gates.
