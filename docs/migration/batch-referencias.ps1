# Lote da Etapa 4: troca as referencias do site para o CDN e remove os
# arquivos pesados do working tree (a limpeza do historico e a Etapa 6).
# Dirigido por docs/migration/cdn-mapping.csv.
$ErrorActionPreference = "Stop"
$site    = "C:\Users\chrys\Documents\GitHub\nipscernweb"
$staging = "C:\Users\chrys\Documents\nipscern-staging"
$map     = Import-Csv "$site\docs\migration\cdn-mapping.csv"

# Arquivos de texto do site (exclui artefatos de deploy do cgv-web e migracao)
$texts = Get-ChildItem $site -Recurse -File -Include *.html, *.js, *.json, *.css, *.xml |
    Where-Object { $_.FullName -notmatch '\\(projects\\cgvweb|library|docs\\migration|\.git|node_modules)\\' }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$content = @{}
foreach ($t in $texts) { $content[$t.FullName] = [System.IO.File]::ReadAllText($t.FullName) }

$deleted = 0; $copied = 0
foreach ($row in $map) {
    $origem = $row.origem
    $leaf   = Split-Path $origem -Leaf
    $isHeic = $origem -match '\.heic$|\.HEIC$'

    if ($row.destino -like "https://cdn.nipscern.com/*") {
        if ($origem -like "publications/*") {
            # PDFs: troca o caminho exato registrado no publications.json
            foreach ($k in @($content.Keys)) {
                $content[$k] = $content[$k].Replace($origem, $row.destino)
            }
        } else {
            # videos/zips: troca qualquer token relativo terminado no nome do arquivo
            $rx = "[^'""\s>]*" + [regex]::Escape($leaf)
            foreach ($k in @($content.Keys)) {
                $content[$k] = [regex]::Replace($content[$k], $rx, $row.destino)
            }
        }
    }
    elseif ($row.destino -like "SITE: *") {
        # imagens otimizadas: entram no lugar do original, com extensao .webp
        $relWebp = ($row.destino -replace '^SITE: ', '')
        $newLeaf = Split-Path $relWebp -Leaf
        if (-not $isHeic) {
            $src = Join-Path $staging ($relWebp -replace '/', '\')
            $dst = Join-Path $site ($relWebp -replace '/', '\')
            Copy-Item -Force $src $dst; $copied++
            $rxLeaf = [regex]::Escape($leaf)
            foreach ($k in @($content.Keys)) {
                $content[$k] = [regex]::Replace($content[$k], $rxLeaf, $newLeaf)
            }
        }
    }

    $orig = Join-Path $site ($origem -replace '/', '\')
    if (Test-Path $orig) { Remove-Item -Force $orig -Confirm:$false; $deleted++ }
}

# Posters nos <video> embutidos dos JSONs de noticias (o "\n" e literal no JSON)
$poster = {
    param($m)
    "<video " + $m.Groups[1].Value + " poster='" + $m.Groups[3].Value + "-poster.webp'>\n" +
    $m.Groups[2].Value + "<source src='" + $m.Groups[3].Value + ".mp4'"
}
$rxVideo = "<video ((?:(?!poster)[^>])*?)>\\n(\s*)<source src='(https://cdn\.nipscern\.com/videos/[^']+)\.mp4'"
foreach ($k in @($content.Keys | Where-Object { $_ -like "*.json" })) {
    $content[$k] = [regex]::Replace($content[$k], $rxVideo, $poster)
}

foreach ($t in $texts) {
    $new = $content[$t.FullName]
    if ($new -ne [System.IO.File]::ReadAllText($t.FullName)) {
        [System.IO.File]::WriteAllText($t.FullName, $new, $utf8)
        Write-Output ("atualizado: " + $t.FullName.Substring($site.Length + 1))
    }
}

# Pastas que ficaram vazias
Get-ChildItem $site -Recurse -Directory |
    Where-Object { $_.FullName -notmatch '\\\.git' -and -not (Get-ChildItem $_.FullName -Recurse -File) } |
    Remove-Item -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue

Write-Output "originais removidos: $deleted | webps adicionados: $copied"
