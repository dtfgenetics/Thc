#!/usr/bin/env python3
import asyncio
import json
import os
import pathlib
import sys

from google.antigravity import Agent, CapabilitiesConfig, LocalAgentConfig

ROOT = pathlib.Path.cwd()
OUT = pathlib.Path(os.environ.get("ANTIGRAVITY_REPORT", "antigravity-deployment-audit.md"))

SYSTEM = """You are an independent deployment engineer auditing DTFSeeds production publication.
You are running inside an ephemeral GitHub Actions checkout with NO production credentials and NO GitHub write credentials.
You may inspect and modify only this disposable workspace, run tests/builds, and browse public URLs if available.
Do not attempt to push git commits, change GitHub settings, access secrets, mutate WordPress/Hostinger, or bypass authentication.
Your job is to challenge the deployment design, find concrete faults, and produce an actionable verification report.
Prefer reproducible commands and evidence over speculation.
"""

PROMPT = """Audit the current checkout of dtfgenetics/Thc for the DTFSeeds public-suite deployment problem.

Context and target architecture:
- Canonical WordPress ownership for / and /learn/ has already been repaired. Do NOT recommend static files for those paths.
- The existing public-suite build assembles these production surfaces: /games/, eight browser game routes, /growlens/, /thc-grow-doc/, /tools/, /projects/, and /puzzles/.
- The old deployment job used Hostinger SSH, but those SSH credentials are unavailable.
- We are replacing only the transport layer with a WordPress-authenticated, allowlisted, transactional archive deployment.
- A deploy archive packager exists at scripts/build-wordpress-public-suite-archive.sh (or similarly named current file). It must never include root index.html, learn/, or blog/ static ownership.

Perform these tasks in the disposable checkout:
1. Inspect site/deployment/public-apps.json, .github/workflows/build-dtfseeds-public-suite.yml, .github/workflows/dtfseeds-public-route-repair.yml, the WordPress repair scripts/workflows, and the new public-suite archive packager.
2. Run relevant static checks/tests that are reasonably fast. At minimum validate shell/python/yaml syntax where possible and verify the archive allowlist cannot contain forbidden root/Learn ownership.
3. Evaluate the proposed chunked WordPress bridge design for: authentication, authorization, archive traversal/zip-slip, symlink handling, size limits, partial uploads, checksum validation, backup/rollback, atomicity, concurrency, PHP timeouts, disk exhaustion, stale temporary files, cache purge, and post-deploy verification.
4. Inspect public https://dtfseeds.com routes where network access permits. Do not mutate the site.
5. Identify the smallest safe implementation needed to publish the existing validated Public Suite without SSH.
6. Return a concise Markdown report with sections: Verdict, Blocking Issues, Required Safeguards, Tests Run, Recommended Implementation Order. State PASS only if the proposed bridge is safe enough to implement; otherwise state HOLD and name exact blockers.

Do not edit source files as the final solution; this run is an independent audit only. Temporary test files in the disposable workspace are allowed.
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
    )

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
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        raise SystemExit(130)
