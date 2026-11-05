// The Tally connector. Runs on the Windows computer where TallyPrime (or Tally.ERP 9) is open,
// asks Tally's built-in XML server for group and ledger totals, and posts them to /api/tally/push.
// Works in Windows PowerShell 5.1 (built into Windows 10/11) and PowerShell 7. Keep it ASCII-only.
export const TALLY_PS1 = String.raw`#K360-SCRIPT
# Karobar360 - Tally connector for __COMPANY__
# Sends monthly sales, purchases, expenses, debtors, creditors, cash and bank from Tally to Karobar360.
# Tally must be open with: F1 Help > Settings > Connectivity > Client/Server configuration
#   "TallyPrime acts as" = Both (or Server), Port = 9000.   (Tally.ERP 9: F12 > Advanced Configuration)
# Run by hand:  powershell -NoProfile -ExecutionPolicy Bypass -File "<this file>"
# Stop it:      schtasks /delete /tn "Karobar360 Tally" /f

$Key = "__KEY__"
$Api = "__API__"
$Tally = "http://localhost:9000"
$Only = ""   # put one company name here to send only that company; empty sends every company open in Tally

$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$Here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$Log = Join-Path $Here "karobar360-tally.log"

function Say($msg) {
  $line = "{0}  {1}" -f (Get-Date -Format "dd-MM-yyyy HH:mm:ss"), $msg
  Write-Host $line
  try {
    if ((Test-Path $Log) -and ((Get-Item $Log).Length -gt 200KB)) { Remove-Item $Log -Force }
    Add-Content -Path $Log -Value $line
  } catch {}
}

function Ask($body) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $r = Invoke-WebRequest -Uri $Tally -Method Post -Body $bytes -ContentType "text/xml; charset=utf-8" -UseBasicParsing -TimeoutSec 240
  $raw = $r.RawContentStream.ToArray()
  # Tally answers in UTF-8 or, in some setups, UTF-16.
  if ($raw.Length -ge 2 -and $raw[0] -eq 0xFF -and $raw[1] -eq 0xFE) { return [Text.Encoding]::Unicode.GetString($raw, 2, $raw.Length - 2) }
  if ($raw.Length -ge 2 -and $raw[1] -eq 0) { return [Text.Encoding]::Unicode.GetString($raw) }
  return [Text.Encoding]::UTF8.GetString($raw)
}

function Esc($s) { return [Security.SecurityElement]::Escape($s) }

function Req($id, $type, $fetch, $company, $from, $to) {
  $sv = '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>'
  if ($company) { $sv += '<SVCURRENTCOMPANY>' + (Esc $company) + '</SVCURRENTCOMPANY>' }
  if ($from) { $sv += "<SVFROMDATE>$from</SVFROMDATE><SVTODATE>$to</SVTODATE>" }
  $col = '<COLLECTION NAME="' + $id + '" ISMODIFY="No"><TYPE>' + $type + '</TYPE><FETCH>' + $fetch + '</FETCH></COLLECTION>'
  return '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>' + $id + '</ID></HEADER><BODY><DESC><STATICVARIABLES>' + $sv + '</STATICVARIABLES><TDL><TDLMESSAGE>' + $col + '</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>'
}

function Companies() {
  $xml = Ask (Req "K360C" "Company" "Name" $null $null $null)
  $names = @()
  foreach ($m in [regex]::Matches($xml, '<COMPANY\b([^>]*)>([\s\S]*?)</COMPANY>')) {
    $n = ""
    $a = [regex]::Match($m.Groups[1].Value, 'NAME="([^"]*)"')
    if ($a.Success) { $n = $a.Groups[1].Value } else {
      $t = [regex]::Match($m.Groups[2].Value, '<NAME[^>]*>([^<]*)</NAME>')
      if ($t.Success) { $n = $t.Groups[1].Value }
    }
    $n = [Net.WebUtility]::HtmlDecode($n).Trim()
    if ($n -and ($names -notcontains $n)) { $names += $n }
  }
  return ,$names
}

function ReadCompany($company) {
  $months = @()
  $now = Get-Date
  for ($i = 12; $i -ge 0; $i--) {
    $first = (Get-Date -Year $now.Year -Month $now.Month -Day 1).AddMonths(-$i)
    $last = $first.AddMonths(1).AddDays(-1)
    if ($i -eq 0) { $last = $now }
    $fy = if ($first.Month -ge 4) { $first.Year } else { $first.Year - 1 }
    $to = $last.ToString("yyyyMMdd")
    $xml = Ask (Req "K360G" "Group" "Name,Parent,ClosingBalance" $company ("{0}0401" -f $fy) $to)
    $months += @{ m = $first.ToString("yyyy-MM"); to = $to; xml = $xml }
  }
  $ledgers = Ask (Req "K360L" "Ledger" "Name,Parent,ClosingBalance" $company $null $null)
  $groups = Ask (Req "K360P" "Group" "Name,Parent" $company $null $null)
  return @{ company = $company; months = $months; ledgers = $ledgers; groups = $groups }
}

try { Invoke-WebRequest -Uri $Tally -UseBasicParsing -TimeoutSec 15 | Out-Null }
catch { Say "Tally is not answering on $Tally. Open Tally and switch on Client/Server connectivity on port 9000."; exit 1 }

$list = @()
if ($Only) { $list = @($Only) } else {
  try { $list = Companies } catch { $list = @() }
}
if (-not $list.Count) { $list = @("") }   # no list: use the company that is active in Tally

$all = @()
foreach ($c in $list) {
  try { $all += ReadCompany $c; Say ("Read " + $(if ($c) { $c } else { "the open company" })) }
  catch { Say ("Could not read " + $c + ": " + $_.Exception.Message) }
}
if (-not $all.Count) { Say "Nothing read from Tally. Open a company in Tally and try again."; exit 1 }

$payload = @{ v = 2; computer = $env:COMPUTERNAME; companies = $all } | ConvertTo-Json -Depth 6 -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
$ms = New-Object IO.MemoryStream
$gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress)
$gz.Write($bytes, 0, $bytes.Length); $gz.Close()
$body = '{"gz":"' + [Convert]::ToBase64String($ms.ToArray()) + '"}'

for ($try = 1; $try -le 3; $try++) {
  try {
    $r = Invoke-RestMethod -Uri $Api -Method Post -Headers @{ "x-karobar-key" = $Key } -ContentType "application/json" -Body $body -TimeoutSec 60
    Say ("Karobar360: " + $r.message); exit 0
  } catch {
    $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 401) { Say "Karobar360 did not accept this connector's key. Download the connector again from the Tally page."; exit 1 }
    if ($try -eq 3) { Say ("Could not reach Karobar360: " + $_.Exception.Message); exit 1 }
    Start-Sleep -Seconds (10 * $try)
  }
}
`;

/** One-click setup for Windows: saves the connector, sends figures once, and schedules it every 15 minutes. */
export function setupCmd(ps1: string) {
  const head = [
    "@echo off",
    "title Karobar360 - Tally connector setup",
    'set "K360=%LOCALAPPDATA%\\Karobar360"',
    'set "K360SELF=%~f0"',
    'if not exist "%K360%" mkdir "%K360%"',
    "echo Installing the Karobar360 Tally connector in %K360% ...",
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:K360SELF); $i=$t.IndexOf('#'+'K360-SCRIPT'); [IO.File]::WriteAllText((Join-Path $env:K360 'karobar360-tally.ps1'), $t.Substring($i), (New-Object Text.UTF8Encoding $false))"`,
    '> "%K360%\\karobar360-tally.vbs" echo CreateObject("WScript.Shell").Run "powershell -NoProfile -ExecutionPolicy Bypass -File ""%K360%\\karobar360-tally.ps1""", 0, False',
    "echo.",
    "echo Sending figures from Tally for the first time. Keep Tally open.",
    'powershell -NoProfile -ExecutionPolicy Bypass -File "%K360%\\karobar360-tally.ps1"',
    'schtasks /create /f /sc minute /mo 15 /tn "Karobar360 Tally" /tr "wscript.exe \\"%K360%\\karobar360-tally.vbs\\"" >nul',
    "if errorlevel 1 (echo Could not schedule the 15-minute update. Run this file again as administrator.) else (echo Done. Tally figures will be sent every 15 minutes while this computer is on.)",
    "echo.",
    "pause",
    "exit /b",
    "",
  ].join("\r\n");
  return head + ps1.replace(/\r?\n/g, "\r\n");
}
