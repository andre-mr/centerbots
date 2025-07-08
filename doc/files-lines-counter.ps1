$totalLines = 0
$totalFiles = 0

Get-ChildItem -Path ..\src -Recurse -Include *.ts,*.tsx -File | ForEach-Object {
    $totalFiles++
    $lines = (Get-Content -LiteralPath $_.FullName | Measure-Object -Line).Lines
    Write-Host "$lines linhas em $($_.Name)"
    $totalLines += $lines
}

Write-Host "Total de arquivos: $totalFiles"
Write-Host "Total de linhas:   $totalLines"
