# Lote da Etapa 3: todos os PDFs de publications/ -> nipscern-assets/publications/
# Recomprime via Ghostscript (/ebook); nomes em kebab-case sem acentos.
$ErrorActionPreference = "Stop"
$site   = "C:\Users\chrys\Documents\GitHub\nipscernweb"
$assets = "C:\Users\chrys\Documents\GitHub\nipscern-assets"
. "$site\tools\optimize-media.ps1"

$rows  = @()
$names = @{}
$pdfs  = Get-ChildItem "$site\publications" -Recurse -Include *.pdf -File | Sort-Object FullName
foreach ($p in $pdfs) {
    $rel   = $p.FullName.Substring($site.Length + 1) -replace '\\', '/'
    $kebab = Get-KebabName $p.Name
    # colisao de nomes vindos de pastas diferentes: sufixa -2, -3...
    $n = 2
    while ($names.ContainsKey($kebab)) {
        $kebab = ($kebab -replace '\.pdf$', '') + "-$n.pdf"; $n++
    }
    $names[$kebab] = $true
    $dest = Join-Path "$assets\publications" $kebab
    $mbIn = [math]::Round($p.Length / 1MB, 1)
    Optimize-Pdf -In $p.FullName -Out $dest
    $mbOut = [math]::Round((Get-Item $dest).Length / 1MB, 1)
    $rows += [pscustomobject]@{ origem = $rel; destino = "https://cdn.nipscern.com/publications/$kebab"; mb_antes = $mbIn; mb_depois = $mbOut }
    Write-Output ("{0} : {1} MB -> {2} MB" -f $kebab, $mbIn, $mbOut)
}
$rows | Export-Csv "$site\docs\migration\map-pdfs.csv" -NoTypeInformation -Encoding UTF8
Write-Output "PDFS CONCLUIDOS: $($rows.Count)"
