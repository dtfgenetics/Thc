#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { printf "%b\n" "${YELLOW}$*${NC}"; }
ok() { printf "%b\n" "${GREEN}$*${NC}"; }
fail() { printf "%b\n" "${RED}$*${NC}" >&2; exit 1; }

printf "%b\n" "${GREEN}🤖 Setting up AI tools for the DTF Games workspace${NC}"
printf "%s\n" "=================================================="

[[ -f package.json ]] || fail "Run this from the dtfgenetics/Thc repository; package.json is missing."
[[ -f package-lock.json ]] || fail "package-lock.json is required. This workspace is npm-based."
[[ -f AGENTS.md ]] || fail "AGENTS.md is missing. Repository agent rules must exist before setup."
[[ -f CLAUDE.md ]] || fail "CLAUDE.md is missing. Repository safety rules must exist before setup."
[[ -f AI_CONTEXT.md ]] || fail "AI_CONTEXT.md is missing."

command -v node >/dev/null 2>&1 || fail "Node.js is required. Install Node.js 22 or newer."
command -v npm >/dev/null 2>&1 || fail "npm is required."

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  fail "Node.js 22 or newer is required; found $(node --version)."
fi

ok "✓ Node $(node --version)"
ok "✓ npm $(npm --version)"
ok "✓ Repository agent instructions found"

info "📦 Installing the committed dependency graph with npm ci..."
npm ci

info "🧭 Checking game ownership and deployment routes..."
npm run games:status

info "🧪 Running the unified game preflight..."
npm run games:preflight

ok "✓ AI-friendly DTF workspace setup complete"
printf "\nRead first: AGENTS.md → CLAUDE.md → AI_CONTEXT.md → project source-of-truth docs\n"
printf "Before editing a game: npm run games:status -- --id <game-id>\n"
printf "Before opening a PR: npm run games:preflight\n"
