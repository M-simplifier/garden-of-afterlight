param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string]$WorkingDirectory = (Split-Path $PSScriptRoot -Parent),
    [ValidateRange(2, 60000)][int]$Frames = 360,
    [ValidateSet('high', 'balanced', 'light')][string]$Quality = 'high',
    [string]$Scene = 'day',
    [ValidateSet('', 'story', 'islands')][string]$Tour = '',
    [ValidateRange(10, 1800)][int]$TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $WorkingDirectory).Path
$binary = (Resolve-Path -LiteralPath $Executable).Path
$relativeOutput = '.runtime/observe-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
$output = Join-Path $root $relativeOutput
New-Item -ItemType Directory -Path $output | Out-Null

# Child-only environment: launching a check never changes the user's controls,
# save path, audio settings, or subsequent interactive launches.
$start = [System.Diagnostics.ProcessStartInfo]::new()
$start.FileName = $binary
$start.WorkingDirectory = $root
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
foreach ($name in @('GARDEN_TOUR', 'GARDEN_SCALE', 'GARDEN_SHADOWS', 'GARDEN_CLOUDS', 'GARDEN_AO', 'GARDEN_BLOOM')) {
    $start.EnvironmentVariables.Remove($name)
}
$start.EnvironmentVariables['GARDEN_INPUT'] = 'observe'
$start.EnvironmentVariables['GARDEN_FRAMES'] = [string]$Frames
$start.EnvironmentVariables['GARDEN_SHOT'] = [string]($Frames - 2)
$start.EnvironmentVariables['GARDEN_IMAGE'] = $relativeOutput + '/scene.png'
$start.EnvironmentVariables['GARDEN_QUALITY'] = $Quality
$start.EnvironmentVariables['GARDEN_SCENE'] = $Scene
$start.EnvironmentVariables['GARDEN_HUD'] = '0'
$start.EnvironmentVariables['GARDEN_PAUSED'] = $(if ($Tour) { '0' } else { '1' })
if ($Tour) { $start.EnvironmentVariables['GARDEN_TOUR'] = $Tour }
$started = [DateTime]::UtcNow
$process = [System.Diagnostics.Process]::Start($start)
$stdout = $process.StandardOutput.ReadToEndAsync()
$stderr = $process.StandardError.ReadToEndAsync()
try {
    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        $process.Kill() # Only the bounded check this script created.
        $process.WaitForExit()
        throw 'The observer exceeded its time limit.'
    }
    [IO.File]::WriteAllText((Join-Path $output 'stdout.log'), $stdout.GetAwaiter().GetResult())
    [IO.File]::WriteAllText((Join-Path $output 'stderr.log'), $stderr.GetAwaiter().GetResult())
    if ($process.ExitCode -ne 0) { throw "Observer exited with code $($process.ExitCode); see $output" }
    $timing = Join-Path $root '.runtime/garden/frame-times.csv'
    if (Test-Path -LiteralPath $timing) { Copy-Item -LiteralPath $timing -Destination $output }
    if (-not $Tour -and -not (Test-Path -LiteralPath (Join-Path $output 'scene.png'))) {
        throw 'The observer did not produce its requested screenshot.'
    }
    if ($Tour) {
        $tourPath = Join-Path $root '.runtime/garden/tour-result.txt'
        if (-not (Test-Path -LiteralPath $tourPath) -or (Get-Item -LiteralPath $tourPath).LastWriteTimeUtc -lt $started) {
            throw 'The observer did not produce a fresh tour result.'
        }
        $result = Get-Content -LiteralPath $tourPath -Raw
        Copy-Item -LiteralPath $tourPath -Destination $output
        $finished = if ($Tour -eq 'islands') { $result -match '(?m)^pilot=Pilot 4 ' } else { $result -match '(?m)^stage=returned' }
        if (-not $finished) { throw "The tour reached its frame limit before completing; see $output" }
    }
    Write-Output $output
} finally { $process.Dispose() }
