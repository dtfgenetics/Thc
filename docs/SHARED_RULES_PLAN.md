# Shared Rules Plan

Before online mode is finished, shared rules should move into one package.

Target folder:

```txt
packages/high-land-rules/
```

Move or duplicate carefully:

- boardPath
- dice rules
- movement rules
- turn rules
- card effect rules
- player validation

Why:

- Web app and server must agree.
- Online mode should not trust the browser.
- Tests should cover both local and online behavior.

Do this after local mode passes tests and browser playtest.
