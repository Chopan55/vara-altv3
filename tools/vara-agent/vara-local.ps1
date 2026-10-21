param(
  [Parameter(Position = 0)]
  [string]$Goal,
  [int]$ResumeIssue
)

$ErrorActionPreference = 'Stop'
$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $Goal -and -not $ResumeIssue) {
  $Goal = Read-Host 'Que queres que hagan Claude y Codex'
}

$oldGoal = $env:GOAL
$oldResume = $env:RESUME_ISSUE
try {
  if ($ResumeIssue) {
    $env:RESUME_ISSUE = [string]$ResumeIssue
    Remove-Item Env:GOAL -ErrorAction SilentlyContinue
  } else {
    $env:GOAL = $Goal
    Remove-Item Env:RESUME_ISSUE -ErrorAction SilentlyContinue
  }

  & npm run local --prefix $bridgeDir
  exit $LASTEXITCODE
} finally {
  if ($null -eq $oldGoal) { Remove-Item Env:GOAL -ErrorAction SilentlyContinue } else { $env:GOAL = $oldGoal }
  if ($null -eq $oldResume) { Remove-Item Env:RESUME_ISSUE -ErrorAction SilentlyContinue } else { $env:RESUME_ISSUE = $oldResume }
}
