$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $PSScriptRoot '.local/processes.json'
if (!(Test-Path -LiteralPath $pidFile)) { Write-Host 'No saved IssueFlow processes.'; return }
$savedProcesses = Get-Content -LiteralPath $pidFile | ConvertFrom-Json
foreach ($entry in $savedProcesses) {
    $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
    # Match creation time too, so a recycled process ID cannot stop another app.
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $entry.started) { Stop-Process -Id $entry.id }
}
Remove-Item -LiteralPath $pidFile
Write-Host 'IssueFlow servers stopped.'
