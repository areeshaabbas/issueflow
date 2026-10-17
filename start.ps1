$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$runtimeDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$env:TEMP = $runtimeDir
$env:TMP = $runtimeDir
$pythonExe = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) {
    python -m venv --without-pip (Join-Path $projectRoot 'backend/.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.13 or later, then try again.' }
}
& $pythonExe -c 'import fastapi, uvicorn, sqlalchemy, jwt, pwdlib, psycopg, pydantic_settings, email_validator' 2>$null
if ($LASTEXITCODE -ne 0) {
    python -m pip --python $pythonExe install -r (Join-Path $projectRoot 'backend/requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the network connection and Python pip installation.' }
}
$backendEnv = Join-Path $projectRoot 'backend/.env'
if (!(Test-Path -LiteralPath $backendEnv)) {
    $secret = & $pythonExe -c 'import secrets; print(secrets.token_urlsafe(48))'
    @("DATABASE_URL=sqlite:///./issueflow.db", "JWT_SECRET=$secret", "CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173", "COOKIE_SECURE=false") | Set-Content -LiteralPath $backendEnv
}
Push-Location (Join-Path $projectRoot 'frontend')
try {
    if (!(Test-Path -LiteralPath 'node_modules')) {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    }
} finally { Pop-Location }
foreach ($port in @(8000,5173)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use. If IssueFlow is running, open http://127.0.0.1:5173. Otherwise stop the process using that port."
    }
}
$backendProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'backend.log') -RedirectStandardError (Join-Path $runtimeDir 'backend-error.log') -PassThru
$nodeExe = (Get-Command node.exe).Source
$viteScript = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
$frontendProcess = Start-Process -FilePath $nodeExe -ArgumentList @("`"$viteScript`"",'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'frontend.log') -RedirectStandardError (Join-Path $runtimeDir 'frontend-error.log') -PassThru
@(@{ id = $backendProcess.Id; started = $backendProcess.StartTime.ToUniversalTime().ToString('o') }, @{ id = $frontendProcess.Id; started = $frontendProcess.StartTime.ToUniversalTime().ToString('o') }) | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'processes.json')
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
        $null = Invoke-WebRequest 'http://127.0.0.1:8000/health' -TimeoutSec 2
        $null = Invoke-WebRequest 'http://127.0.0.1:5173' -TimeoutSec 2
        $ready = $true
        break
    } catch { Start-Sleep -Seconds 1 }
}
if (!$ready) { throw 'Startup did not finish. Check the log files in .local, then run stop.ps1 before retrying.' }
Write-Host 'IssueFlow is ready: http://127.0.0.1:5173'
Write-Host 'Register your account to begin. API documentation: http://127.0.0.1:8000/docs'
Write-Host 'Run ./stop.ps1 to stop both servers.'
