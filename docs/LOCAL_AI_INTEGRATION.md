# DTF Local AI Integration

This integration adds local/open AI providers without making any provider the system of record.

## GrowLens

Visual intake follows an observation-first pipeline:

```text
private image
 -> same-origin GrowLens API
 -> configured vision gateway
 -> object localization (YOLO-compatible)
 -> visual description (Moondream-compatible)
 -> canonical machine observation
 -> independent differential
 -> THC dataset/evidence verification
 -> final response
```

Machine vision is evidence collection, not diagnosis. The public client rejects direct diagnostic claims from the visual gateway.

Production configuration:

- `GROWLENS_AI_VISION_URL` — HTTPS gateway endpoint. HTTP is accepted only for localhost development.
- `GROWLENS_AI_GATEWAY_TOKEN` — optional server-side bearer token.

Provider credentials and endpoints stay server-side. The browser calls only the same-origin GrowLens API. AI endpoints require an authenticated session, CSRF validation, and rate limiting.

The gateway receives a versioned request containing an image and explicit constraints. The gateway may use Moondream for visual description and a YOLO-family detector for regions/object localization. It must return visible findings, regions, limitations, provider/model provenance, and no final diagnosis.

Whisper is registered for future voice intake. Voice transcription must feed structured intake rather than diagnostic authority. Piper is presentation-only and must never control hardware or authorize treatment.

## Project OS

Project OS remains the durable controller. OpenCode and Hermes are optional worker runtimes; Qwen and gpt-oss are optional model providers.

```text
Project OS job
 -> provider router
 -> OpenCode/Hermes runtime
 -> Qwen/gpt-oss model
 -> repository verification profile
 -> PR
 -> release controller
 -> live QA
```

Use:

```bash
npm run plan:local-ai-worker -- code --json
npm run verify:local-ai-integration
```

Local workers have no production authority.

## Hardware lane

ESP32/Raspberry Pi integration should enter through the existing telemetry/provider contracts in the canonical Tools repository. Edge devices should publish measurements and camera evidence; they must not bypass GrowLens evidence contracts or directly actuate equipment from AI output.

## Media generation

Video/image generators remain offline asset producers. Generated education/media assets must pass DTF asset review, licensing/provenance tracking, optimization, and release gates before publication.
