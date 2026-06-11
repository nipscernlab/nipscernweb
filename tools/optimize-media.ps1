<#
Ferramentas de otimizacao de midia do NIPSCERN.

Usado na migracao para o cdn.nipscern.com e tambem no dia a dia, para
preparar qualquer arquivo novo antes de subir ao repo nipscern-assets.

Uso avulso (dot-source e chame a funcao):
  . .\tools\optimize-media.ps1
  Optimize-Image -In foto.heic -Out images\foto.webp
  Optimize-Video -In video.mp4 -Out videos\video.mp4
  Optimize-Pdf   -In tese.pdf  -Out publications\tese.pdf
  Get-KebabName  "MEST 2025 João da Silva.pdf"   # -> mest-2025-joao-da-silva.pdf

Requisitos: ImageMagick (magick), FFmpeg (ffmpeg), Ghostscript (gswin64c).
#>

$ErrorActionPreference = "Stop"

function Get-GsPath {
    $cmd = Get-Command gswin64c -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $dirs = @(Get-ChildItem "C:\Program Files\gs" -Directory -ErrorAction SilentlyContinue | Sort-Object Name)
    if ($dirs.Count -gt 0) { return (Join-Path $dirs[-1].FullName "bin\gswin64c.exe") }
    throw "Ghostscript nao encontrado."
}

# Converte um nome de arquivo para kebab-case sem acentos:
# "MEST 2025 João_da_Silva.PDF" -> "mest-2025-joao-da-silva.pdf"
function Get-KebabName([string]$Name) {
    $ext  = [System.IO.Path]::GetExtension($Name).ToLower()
    $base = [System.IO.Path]::GetFileNameWithoutExtension($Name)
    $base = $base.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
    $base = $base.ToLower() -replace '[_\s]+', '-' -replace '[^a-z0-9\-]', '' -replace '-{2,}', '-'
    return ($base.Trim('-') + $ext)
}

# Redimensiona para no maximo 2560 px no lado maior e converte para WebP q80.
function Optimize-Image([string]$In, [string]$Out, [int]$MaxDim = 2560, [int]$Quality = 80) {
    New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
    magick $In -auto-orient -resize "${MaxDim}x${MaxDim}>" -quality $Quality $Out
    if ($LASTEXITCODE -ne 0) { throw "magick falhou em $In" }
}

# Re-encoda para 1080p (lado maior 1920 px), H.264 CRF 23, audio AAC 128k.
function Optimize-Video([string]$In, [string]$Out, [int]$MaxDim = 1920, [int]$Crf = 23) {
    New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
    $scale = "scale=ceil(iw*min(1\,$MaxDim/max(iw\,ih))/2)*2:ceil(ih*min(1\,$MaxDim/max(iw\,ih))/2)*2"
    ffmpeg -y -hide_banner -loglevel error -i $In -vf $scale `
        -c:v libx264 -crf $Crf -preset medium -pix_fmt yuv420p `
        -c:a aac -b:a 128k -movflags +faststart $Out
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg falhou em $In" }
}

# Extrai um quadro do video como poster WebP (para <video poster=...>).
function New-VideoPoster([string]$In, [string]$Out, [string]$At = "00:00:01") {
    New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
    ffmpeg -y -hide_banner -loglevel error -ss $At -i $In -frames:v 1 -quality 80 $Out
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg (poster) falhou em $In" }
}

# Recomprime PDF via Ghostscript (/ebook, 150 dpi). Se o resultado nao
# ficar menor, mantem o original (PDFs ja otimizados passam intactos).
function Optimize-Pdf([string]$In, [string]$Out, [string]$Preset = "/ebook") {
    New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
    $gs = Get-GsPath
    $tmp = "$Out.tmp.pdf"
    # Invocacao via cmd /c: o PowerShell 5.1 mutila argumentos com "=" do gs
    cmd /c "`"$gs`" -q -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=$Preset -o `"$tmp`" `"$In`" 2>nul"
    $ok = ($LASTEXITCODE -eq 0) -and (Test-Path $tmp) -and ((Get-Item $tmp).Length -gt 1024)
    if ($ok -and ((Get-Item $tmp).Length -lt (Get-Item $In).Length)) {
        Move-Item -Force $tmp $Out
    } else {
        if (Test-Path $tmp) { Remove-Item -Force $tmp }
        Copy-Item -Force $In $Out
    }
}
