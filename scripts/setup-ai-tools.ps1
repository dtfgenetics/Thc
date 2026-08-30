$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
& node "$RootDir/scripts/setup-ai-tools.mjs" @args
exit $LASTEXITCODE
