# Lote da Etapa 3: imagens >2 MB e HEICs -> WebP (max 2560 px, q80).
# Resultado <2 MB fica aguardando a troca in-place no site (staging);
# resultado >=2 MB vai para nipscern-assets/images/.
$ErrorActionPreference = "Stop"
$site    = "C:\Users\chrys\Documents\GitHub\nipscernweb"
$assets  = "C:\Users\chrys\Documents\GitHub\nipscern-assets"
$staging = "C:\Users\chrys\Documents\nipscern-staging"
. "$site\tools\optimize-media.ps1"

$rows = @()
$imgs = @(Get-ChildItem "$site\assets" -Recurse -File -Include *.jpg, *.jpeg, *.png | Where-Object { $_.Length -gt 2MB })
$imgs += @(Get-ChildItem "$site\assets" -Recurse -File -Include *.heic)

foreach ($i in $imgs) {
    $rel    = $i.FullName.Substring($site.Length + 1) -replace '\\', '/'
    $relDir = Split-Path $rel -Parent
    $webp   = [System.IO.Path]::GetFileNameWithoutExtension($i.Name) + ".webp"
    $outStg = Join-Path $staging (Join-Path $relDir $webp)
    # HEIC e JPG de mesmo nome na mesma pasta viram o mesmo .webp: sufixa o HEIC
    if ((Test-Path $outStg) -and ($i.Extension -match 'heic')) {
        $webp   = [System.IO.Path]::GetFileNameWithoutExtension($i.Name) + "-heic.webp"
        $outStg = Join-Path $staging (Join-Path $relDir $webp)
    }
    $mbIn = [math]::Round($i.Length / 1MB, 1)
    Optimize-Image -In $i.FullName -Out $outStg
    $outItem = Get-Item $outStg
    $mbOut = [math]::Round($outItem.Length / 1MB, 2)

    if ($outItem.Length -ge 2MB) {
        $kebab = Get-KebabName $webp
        Move-Item -Force $outStg (Join-Path "$assets\images" $kebab)
        $destino = "https://cdn.nipscern.com/images/$kebab"
    } else {
        $destino = "SITE: " + ($relDir -replace '\\', '/') + "/$webp"
    }
    $rows += [pscustomobject]@{ origem = $rel; destino = $destino; mb_antes = $mbIn; mb_depois = $mbOut }
    Write-Output ("{0} : {1} MB -> {2} MB" -f $rel, $mbIn, $mbOut)
}
$rows | Export-Csv "$site\docs\migration\map-imagens.csv" -NoTypeInformation -Encoding UTF8
Write-Output "IMAGENS CONCLUIDAS: $($rows.Count)"
