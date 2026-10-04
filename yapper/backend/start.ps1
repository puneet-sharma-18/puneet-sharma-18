# Start the Yapper server without Docker (Windows PowerShell).
# Run:  powershell -ExecutionPolicy Bypass -File backend\start.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "Created backend\.env - open it, fill in YAPPER_TOKEN and GROQ_API_KEY, then run this again."
    exit 1
}
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\pip.exe install -q -r requirements.txt
$port = if ($env:PORT) { $env:PORT } else { "8000" }
.\.venv\Scripts\python.exe -m yapper.main --host 0.0.0.0 --port $port
