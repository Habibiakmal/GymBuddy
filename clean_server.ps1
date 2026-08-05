$file = 'c:\Users\User\Downloads\GymBuddy-main\GymBuddy-main\server.ts'
$lines = Get-Content $file
$startLine = $null
$endLine = $null

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'Respond immediately so Fonnte' -and $startLine -eq $null) {
        $startLine = $i - 1
    }
    if ($lines[$i] -match 'Fonnte.*Webhook error') {
        $endLine = $i + 2
    }
}

Write-Host "Start: $startLine, End: $endLine"
if ($startLine -ne $null -and $endLine -ne $null) {
    $newLines = $lines[0..($startLine-1)] + $lines[$endLine..($lines.Length-1)]
    $newLines | Set-Content $file -Encoding UTF8
    Write-Host "Done. Total lines: $($newLines.Length)"
} else {
    Write-Host "Pattern not found!"
}
