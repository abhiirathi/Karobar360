// PowerShell connector the owner downloads from the Tally page.
export const TALLY_PS1 = String.raw`# Karobar360 - Tally connector for __COMPANY__
# Reads totals from TallyPrime on this computer and sends them to your Karobar360 dashboard.
# Needs: TallyPrime open, with Help (F1) > Settings > Connectivity > "TallyPrime acts as" = Both (or Server), port 9000.
# Run once to test:  powershell -ExecutionPolicy Bypass -File C:\Karobar360\karobar360-tally.ps1
# Run every 15 minutes:
#   schtasks /create /sc minute /mo 15 /tn "Karobar360 Tally" /tr "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Karobar360\karobar360-tally.ps1"

$Key = "__KEY__"
$Api = "__API__"
$Tally = "http://localhost:9000"
$Company = ""   # leave empty to use the company that is open in Tally

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Ask($body) {
  $r = Invoke-WebRequest -Uri $Tally -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType "text/xml; charset=utf-8" -UseBasicParsing -TimeoutSec 180
  return $r.Content
}
function Req($id, $type, $fetch, $from, $to) {
  $sv = '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>'
  if ($from) { $sv += "<SVFROMDATE>$from</SVFROMDATE><SVTODATE>$to</SVTODATE>" }
  if ($Company) { $sv += "<SVCURRENTCOMPANY>$Company</SVCURRENTCOMPANY>" }
  $col = '<COLLECTION NAME="' + $id + '" ISMODIFY="No"><TYPE>' + $type + '</TYPE><FETCH>' + $fetch + '</FETCH></COLLECTION>'
  return '<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>' + $id + '</ID></HEADER><BODY><DESC><STATICVARIABLES>' + $sv + '</STATICVARIABLES><TDL><TDLMESSAGE>' + $col + '</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>'
}

try { Ask "<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST></HEADER></ENVELOPE>" | Out-Null }
catch { Write-Host "Karobar360: TallyPrime is not answering on $Tally. Open Tally and switch on the connectivity setting (port 9000)."; exit 1 }

$months = @()
$now = Get-Date
for ($i = 12; $i -ge 0; $i--) {
  $first = (Get-Date -Year $now.Year -Month $now.Month -Day 1).AddMonths(-$i)
  $last = $first.AddMonths(1).AddDays(-1)
  if ($i -eq 0) { $last = $now }
  $fy = if ($first.Month -ge 4) { $first.Year } else { $first.Year - 1 }
  $from = "{0}0401" -f $fy
  $to = $last.ToString("yyyyMMdd")
  $xml = Ask (Req "K360G" "Group" "Name,Parent,ClosingBalance" $from $to)
  $months += @{ m = $first.ToString("yyyy-MM"); to = $to; xml = $xml }
}
$ledgers = Ask (Req "K360L" "Ledger" "Name,Parent,ClosingBalance" $null $null)
$groups = Ask (Req "K360P" "Group" "Name,Parent" $null $null)

$payload = @{ company = $Company; months = $months; ledgers = $ledgers; groups = $groups } | ConvertTo-Json -Depth 5 -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
$ms = New-Object IO.MemoryStream
$gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress)
$gz.Write($bytes, 0, $bytes.Length); $gz.Close()
$b64 = [Convert]::ToBase64String($ms.ToArray())

$r = Invoke-RestMethod -Uri $Api -Method Post -Headers @{ "x-karobar-key" = $Key } -ContentType "application/json" -Body (@{ gz = $b64 } | ConvertTo-Json -Compress)
Write-Host ("Karobar360: {0} ({1})" -f $r.message, (Get-Date -Format "dd-MM-yyyy HH:mm"))
`;
