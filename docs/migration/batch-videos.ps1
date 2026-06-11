# Lote da Etapa 3: videos do site -> nipscern-assets/videos/
# Re-encoda >10 MB para 1080p; <=10 MB copia como esta. Gera poster WebP de todos.
$ErrorActionPreference = "Stop"
$site   = "C:\Users\chrys\Documents\GitHub\nipscernweb"
$assets = "C:\Users\chrys\Documents\GitHub\nipscern-assets"
. "$site\tools\optimize-media.ps1"

$rows = @()
$vids = Get-ChildItem "$site\assets" -Recurse -Include *.mp4 -File
foreach ($v in $vids) {
    $rel   = $v.FullName.Substring($site.Length + 1) -replace '\\', '/'
    $kebab = (Get-KebabName $v.Name) -replace '-2160p', ''
    $dest  = Join-Path "$assets\videos" $kebab
    $mbIn  = [math]::Round($v.Length / 1MB, 1)

    if ($v.Length -gt 10MB) {
        Optimize-Video -In $v.FullName -Out $dest
    } else {
        Copy-Item -Force $v.FullName $dest
    }
    $poster = Join-Path "$assets\videos" ($kebab -replace '\.mp4$', '-poster.webp')
    New-VideoPoster -In $dest -Out $poster

    $mbOut = [math]::Round((Get-Item $dest).Length / 1MB, 1)
    $rows += [pscustomobject]@{ origem = $rel; destino = "https://cdn.nipscern.com/videos/$kebab"; mb_antes = $mbIn; mb_depois = $mbOut }
    Write-Output ("{0} : {1} MB -> {2} MB" -f $kebab, $mbIn, $mbOut)
}
$rows | Export-Csv "$site\docs\migration\map-videos.csv" -NoTypeInformation -Encoding UTF8
Write-Output "VIDEOS CONCLUIDOS: $($rows.Count)"
