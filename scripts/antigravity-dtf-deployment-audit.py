#!/usr/bin/env python3
import asyncio
import os
import pathlib

from google.antigravity import Agent, CapabilitiesConfig, LocalAgentConfig

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
- The app-only archive packager is scripts/package-public-suite-wordpress.py.
- The new no-SSH transactional deployer is scripts/deploy-public-suite-via-wordpress.mjs.
- The package/deployer must never create static ownership for root index.html, learn/, or blog/.

Perform these tasks in the disposable checkout:
1. Inspect site/deployment/public-apps.json, .github/workflows/build-dtfseeds-public-suite.yml, .github/workflows/dtfseeds-public-route-repair.yml, scripts/package-public-suite-wordpress.py, scripts/deploy-public-suite-via-wordpress.mjs, and the proven WordPress repair scripts used for filesystem-level repairs.
2. Run relevant static checks/tests that are reasonably fast. At minimum run `node --check scripts/deploy-public-suite-via-wordpress.mjs`, Python compilation for the packager, inspect YAML validity where practical, and reason-test the archive allowlist against forbidden root/Learn/Blog ownership.
3. Evaluate the chunked WordPress bridge for: Basic-auth application-password usage, manage_options authorization, one-time token protection, archive traversal/zip-slip, Windows/backslash paths, symlinks, file and total size limits, partial/ambiguous uploads, chunk and whole-archive checksums, manifest-to-archive equality, required files, disk exhaustion, backup/rollback, multi-target atomicity limitations, concurrency/server locks, PHP timeouts, stale temporary files, cache purge, Code Snippets cleanup, and post-deploy verification.
4. Inspect public https://dtfseeds.com routes where network access permits. Do not mutate the site.
5. Identify any concrete bug that could cause data loss, stale routing, unauthorized mutation, partial deployment, or inability to recover.
6. Return a concise Markdown report with sections: Verdict, Blocking Issues, Required Safeguards, Tests Run, Recommended Implementation Order. State PASS only if the bridge is safe enough for a protected production trial; otherwise state HOLD and name exact blockers with file/logic references.

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
