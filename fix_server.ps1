$file = 'c:\Users\User\Downloads\GymBuddy-main\GymBuddy-main\server.ts'
$lines = Get-Content $file -Encoding UTF8

$metaEndIdx = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '\[Meta WA\] Webhook error:') {
        $metaEndIdx = $i + 2 # skip '  });'
        break
    }
}

$viteStartIdx = -1
for ($i = $metaEndIdx; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'middlewareMode: true') {
        $viteStartIdx = $i - 3 # 'if (process.env.NODE_ENV !== "production") {'
        break
    }
}

Write-Host "MetaEnd: $metaEndIdx, ViteStart: $viteStartIdx"

if ($metaEndIdx -gt 0 -and $viteStartIdx -gt $metaEndIdx) {
    $cleanLines = $lines[0..($metaEndIdx-1)] + $lines[$viteStartIdx..($lines.Length-1)]
    $cleanLines | Set-Content $file -Encoding UTF8
    Write-Host "Cleaned successfully. Total lines: $($cleanLines.Length)"
} else {
    Write-Host "Failed to locate bounds."
}
