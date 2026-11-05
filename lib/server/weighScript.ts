// Weighbridge connector. Runs on the computer next to the weighbridge indicator, reads the weight
// the indicator sends out (serial/COM cable, or a serial-to-network box), and posts it to
// /api/weighbridge/push so the gate screen shows the live weight. Windows PowerShell 5.1; ASCII only.
export const WEIGH_PS1 = String.raw`#K360-SCRIPT
param([switch]$Test)
# Karobar360 - weighbridge connector for __COMPANY__
# Reads the live weight from the weighbridge indicator and shows it on the Karobar360 gate screen.
# Run a 20-second test:  powershell -NoProfile -ExecutionPolicy Bypass -File "<this file>" -Test

$Key = "__KEY__"
$Api = "__API__"
$Port = "auto"   # "auto", a COM port like "COM3", or "tcp:192.168.1.50:4001" for a network weighbridge
$Baud = 0        # 0 tries 9600, 2400, 4800 and 1200. Set it if your indicator manual gives one.
$Unit = "auto"   # "auto", "kg" or "t" (what the indicator sends)
$Reverse = $false # a few indicators send the digits backwards; set to $true if the weight looks reversed

$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Log = Join-Path $Here "karobar360-weighbridge.log"
function Say($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "dd-MM-yyyy HH:mm:ss"), $msg
  Write-Host $line
  try { if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 200KB)) { Remove-Item $Log -Force }; Add-Content -Path $Log -Value $line } catch {}
}

# Turns one frame from the indicator into kilograms, or $null.
function Parse($frame) {
  $f = ($frame -replace '[^\x20-\x7E]', ' ').Trim()
  if (-not $f) { return $null }
  $ms = [regex]::Matches($f, '([+-]?)\s*(\d+(?:\.\d+)?)')
  if (-not $ms.Count) { return $null }
  $best = $ms | Sort-Object { $_.Groups[2].Value.Length } -Descending | Select-Object -First 1
  $digits = $best.Groups[2].Value
  if ($Reverse) { $a = $digits.ToCharArray(); [array]::Reverse($a); $digits = -join $a }
  $v = [double]::Parse($digits, [Globalization.CultureInfo]::InvariantCulture)
  if ($best.Groups[1].Value -eq "-") { $v = -$v }
  $u = $Unit
  if ($u -eq "auto") { if ($f -match '(?i)kg') { $u = "kg" } elseif ($f -match '(?i)\d\s*t\b' -or ($digits.Contains(".") -and [math]::Abs($v) -lt 200)) { $u = "t" } else { $u = "kg" } }
  if ($u -eq "t") { $v = $v * 1000 }
  $flag = if ($f -match '(?i)\bUS\b|unst|motion') { "unstable" } elseif ($f -match '(?i)\bST\b|stab') { "stable" } else { "" }
  return @{ kg = [math]::Round($v); flag = $flag; raw = $f }
}

function Open-Source($spec, $baud) {
  if ($spec -like "tcp:*") {
    $p = $spec.Substring(4).Split(":")
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect($p[0], [int]$p[1])
    $c.ReceiveTimeout = 3000
    return @{ kind = "tcp"; client = $c; stream = $c.GetStream(); name = $spec }
  }
  $sp = New-Object IO.Ports.SerialPort $spec, $baud, ([IO.Ports.Parity]::None), 8, ([IO.Ports.StopBits]::One)
  $sp.ReadTimeout = 3000
  $sp.Open()
  return @{ kind = "serial"; port = $sp; name = "$spec @ $baud" }
}
function Close-Source($s) { try { if ($s.kind -eq "tcp") { $s.client.Close() } else { $s.port.Close() } } catch {} }
function Read-Chunk($s) {
  $buf = New-Object byte[] 512
  if ($s.kind -eq "tcp") {
    $end = (Get-Date).AddMilliseconds(500)
    while (-not $s.stream.DataAvailable) {
      if ((Get-Date) -gt $end) { return "" }
      if ($s.client.Client.Poll(0, [Net.Sockets.SelectMode]::SelectRead) -and $s.client.Available -eq 0) { throw "Connection closed" }
      Start-Sleep -Milliseconds 50
    }
    $n = $s.stream.Read($buf, 0, 512)
  } else {
    if ($s.port.BytesToRead -le 0) { Start-Sleep -Milliseconds 100; return "" }
    $n = $s.port.Read($buf, 0, [math]::Min(512, $s.port.BytesToRead))
  }
  if ($n -le 0) { return "" }
  return [Text.Encoding]::ASCII.GetString($buf, 0, $n)
}

# Finds the port the indicator is talking on.
function Find-Source() {
  if ($Port -ne "auto") {
    $bauds = if ($Baud) { @($Baud) } else { @(9600, 2400, 4800, 1200) }
    if ($Port -like "tcp:*") { return Open-Source $Port 0 }
    foreach ($b in $bauds) {
      $s = Open-Source $Port $b
      $t = ""; $end = (Get-Date).AddSeconds(3)
      while ((Get-Date) -lt $end) { $t += Read-Chunk $s; if (($t -split "[\r\n\x02\x03=]") | Where-Object { Parse $_ }) { return $s } }
      Close-Source $s
    }
    return $null
  }
  foreach ($name in [IO.Ports.SerialPort]::GetPortNames()) {
    foreach ($b in $(if ($Baud) { @($Baud) } else { @(9600, 2400, 4800, 1200) })) {
      try {
        $s = Open-Source $name $b
        $t = ""; $end = (Get-Date).AddSeconds(3)
        while ((Get-Date) -lt $end) { $t += Read-Chunk $s; if (($t -split "[\r\n\x02\x03=]") | Where-Object { Parse $_ }) { return $s } }
        Close-Source $s
      } catch {}
    }
  }
  return $null
}

function Push($kg, $stable, $device, $raw) {
  $body = @{ weight = $kg; stable = $stable; device = $device; raw = $raw } | ConvertTo-Json -Compress
  try { Invoke-RestMethod -Uri $Api -Method Post -Headers @{ "x-karobar-key" = $Key } -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null; return $true }
  catch {
    $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 401) { Say "Karobar360 did not accept this connector's key. Download the weighbridge setup again from Settings."; exit 1 }
    return $false
  }
}

# One copy at a time.
$mutex = New-Object Threading.Mutex($false, "Local\Karobar360Weighbridge")
if (-not $Test -and -not $mutex.WaitOne(0)) { exit 0 }

$device = "$($env:COMPUTERNAME)"
$stopAt = if ($Test) { (Get-Date).AddSeconds(20) } else { [datetime]::MaxValue }
while ((Get-Date) -lt $stopAt) {
  $src = $null
  try { $src = Find-Source } catch { Say ("Could not open the weighbridge: " + $_.Exception.Message) }
  if (-not $src) {
    Say "No weight coming from the weighbridge. Check the cable and that the indicator is on. Trying again in 30 seconds."
    if ($Test) { exit 1 }
    Start-Sleep -Seconds 30; continue
  }
  Say ("Reading the weighbridge on " + $src.name)
  $buf = ""; $hist = New-Object Collections.Generic.List[double]; $lastSent = $null; $lastPush = Get-Date "2000-01-01"
  try {
    while ((Get-Date) -lt $stopAt) {
      $buf += Read-Chunk $src
      $parts = @($buf -split "[\r\n\x02\x03=]")
      $buf = $parts[-1]
      if ($buf.Length -gt 400) { $buf = "" }
      if ($parts.Count -lt 2) { continue }
      foreach ($fr in $parts[0..($parts.Count - 2)]) {
        $r = Parse $fr
        if (-not $r) { continue }
        $hist.Add($r.kg); if ($hist.Count -gt 6) { $hist.RemoveAt(0) }
        $spread = ($hist | Measure-Object -Maximum -Minimum)
        $stable = if ($r.flag -eq "stable") { $true } elseif ($r.flag -eq "unstable") { $false } else { $hist.Count -ge 4 -and ($spread.Maximum - $spread.Minimum) -le 20 }
        $changed = ($lastSent -eq $null) -or ([math]::Abs($r.kg - $lastSent.kg) -ge 10) -or ($stable -ne $lastSent.stable)
        $since = ((Get-Date) - $lastPush).TotalSeconds
        if (($changed -and $since -ge 1) -or $since -ge 10) {
          if ($Test) { Write-Host ("  {0,8} kg  {1}" -f $r.kg, $(if ($stable) { "steady" } else { "moving" })) }
          if (Push $r.kg $stable "$device $($src.name)" $r.raw) { $lastSent = @{ kg = $r.kg; stable = $stable }; $lastPush = Get-Date }
        }
      }
    }
  } catch { Say ("Lost the weighbridge: " + $_.Exception.Message) }
  Close-Source $src
  if (-not $Test) { Start-Sleep -Seconds 5 }
}
if ($Test) { Say "Test finished. If you saw the weight above, it is working." }
`;

/** One-click setup: saves the connector, runs a 20-second test, then starts it now and at every Windows sign-in. */
export function weighSetupCmd(ps1: string) {
  const head = [
    "@echo off",
    "title Karobar360 - weighbridge setup",
    'set "K360=%LOCALAPPDATA%\\Karobar360"',
    'set "K360SELF=%~f0"',
    'if not exist "%K360%" mkdir "%K360%"',
    "echo Installing the Karobar360 weighbridge connector in %K360% ...",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:K360SELF); $i=$t.IndexOf('#'+'K360-SCRIPT'); [IO.File]::WriteAllText((Join-Path $env:K360 'karobar360-weighbridge.ps1'), $t.Substring($i), (New-Object Text.UTF8Encoding $false))"`,
    '> "%K360%\\karobar360-weighbridge.vbs" echo CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""%K360%\\karobar360-weighbridge.ps1""", 0, False',
    "echo.",
    "echo Testing for 20 seconds. Put some weight on the weighbridge, or keep the truck on it.",
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%K360%\\karobar360-weighbridge.ps1" -Test',
    'copy /y "%K360%\\karobar360-weighbridge.vbs" "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\" >nul',
    'wscript.exe "%K360%\\karobar360-weighbridge.vbs"',
    "echo.",
    "echo Done. The weighbridge now shows live on the Karobar360 gate screen, and starts by itself when this computer is switched on.",
    "echo.",
    "pause",
    "exit /b",
    "",
  ].join("\r\n");
  return head + ps1.replace(/\r?\n/g, "\r\n");
}
