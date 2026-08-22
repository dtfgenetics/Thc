#!/usr/bin/env python3
import asyncio
import os
import pathlib

from google.antigravity import Agent, CapabilitiesConfig, LocalAgentConfig
from google.antigravity.hooks import policy

OUT = pathlib.Path(os.environ.get("ANTIGRAVITY_REPORT", "antigravity-deployment-audit.md"))

SYSTEM = """You are an independent deployment engineer auditing DTFSeeds production publication.
You are running inside an ephemeral GitHub Actions checkout with no WordPress/Hostinger credentials and checkout push credentials disabled.
You may inspect files, run commands, create temporary test files, and browse public URLs. Do not attempt to push commits, modify GitHub settings, bypass authentication, or mutate any remote service.
Challenge the deployment design. Prefer reproducible commands and exact file/logic references over speculation.
"""

PROMPT = """Audit the current checkout of dtfgenetics/Thc for the DTFSeeds no-SSH public-suite deployment.

Production constraints:
- WordPress owns / and /learn/. They must never regain static-file ownership.
- The Public Suite contains /games/, eight browser game routes, /growlens/, /thc-grow-doc/, /tools/, /projects/, and /puzzles/.
- Hostinger SSH credentials are unavailable.
- Existing WordPress Application Password + WordPress REST + temporary Code Snippets REST bridge is the proven filesystem workaround.
- App-only archive packager: scripts/package-public-suite-wordpress.py
- Hardened v2 deployer source is stored in scripts/wordpress-suite-v2/ and must be assembled with scripts/assemble-wordpress-suite-v2.py.
- Deterministic validator: .github/workflows/validate-wordpress-public-suite-bridge.yml

Do this in the disposable checkout:
1. Run `python scripts/assemble-wordpress-suite-v2.py /tmp/dtf-suite-v2.mjs` and `node --check /tmp/dtf-suite-v2.mjs`.
2. Inspect the assembled v2 deployer, packager, public-app manifest, build workflow, deterministic validator, and the prior proven WordPress filesystem repair script.
3. Evaluate authentication/authorization, one-time token handling, ZIP traversal/backslash/symlink/duplicate-entry defense, manifest limits, per-chunk and whole-archive hashes, required-file enforcement, disk-space checks, stale locks, partial uploads, PHP disconnect/timeouts, persisted mutation phases, backup/rollback, abort/finalize cleanup, cache purge, temporary Code Snippets cleanup, and post-deploy root/Learn ownership verification.
4. Pay special attention to interruption between: current target -> backup rename, backup rename -> new target rename, new target rename -> state persistence, and HTTP disconnect during commit. Determine whether persisted state can recover each case without deleting the only good copy.
5. Inspect public https://dtfseeds.com read-only if network access permits.
6. Identify any concrete bug that could cause data loss, unauthorized mutation, stale routing, unrecoverable partial deployment, or incorrect success reporting.
7. Return Markdown with sections: Verdict, Blocking Issues, Required Safeguards, Tests Run, Recommended Implementation Order. State PASS only if this v2 bridge is safe enough for one protected production trial. Otherwise state HOLD with exact blockers.

Do not edit repository source as the final solution. Temporary files in the runner are fine.
"""

async def main() -> int:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        OUT.write_text(
            "# Google Antigravity deployment audit\n\n"
            "**Status: NOT RUN**\n\n"
            "`GEMINI_API_KEY` is not configured in the protected GitHub environment, so the official Google Antigravity SDK could not start.\n",
            encoding="utf-8",
        )
        print("GEMINI_API_KEY not configured; wrote NOT RUN report.")
        return 3

    config = LocalAgentConfig(
        api_key=api_key,
        system_instructions=SYSTEM,
        capabilities=CapabilitiesConfig(),
        policies=[policy.allow_all()],
    )
    # The Antigravity runtime already has the explicit credential in config. Remove it
    # from the runner environment before exposing autonomous shell access to the agent.
    os.environ.pop("GEMINI_API_KEY", None)

    try:
        async with Agent(config) as agent:
            response = await agent.chat(PROMPT)
            text = await response.text()
    except Exception as exc:
        OUT.write_text(
            "# Google Antigravity deployment audit\n\n"
            "**Status: ERROR**\n\n"
            f"Antigravity SDK failed: `{type(exc).__name__}: {exc}`\n",
            encoding="utf-8",
        )
        raise

    if not text.strip():
        text = "# Google Antigravity deployment audit\n\n**Status: ERROR**\n\nAgent returned no text.\n"
    OUT.write_text(text.rstrip() + "\n", encoding="utf-8")
    print(text)
    return 0

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
