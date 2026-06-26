Add-Type -AssemblyName System.Drawing

$outDir = "C:\Users\OddTower\Documents\My Apps\ChatConfluence\src-tauri\icons"
$sizes = @(32, 128, 256)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(10, 10, 15))
    $fontSize = [int]($size * 0.28)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, $size * 0.2, $size, $size * 0.6)
    $g.DrawString("CC", $font, [System.Drawing.Brushes]::White, $rect, $sf)
    $g.Dispose()
    $pngPath = Join-Path $outDir ("{0}x{0}.png" -f $size)
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $pngPath"
}

$png256 = Join-Path $outDir "256x256.png"
Copy-Item $png256 (Join-Path $outDir "icon.png")

# Create minimal valid ICO (1 image, 256x256 PNG payload)
$pngBytes = [System.IO.File]::ReadAllBytes($png256)
$ico = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($ico)
$writer.Write([byte[]](0, 0, 1, 0))
$writer.Write([byte](0))
$writer.Write([byte](0))
$writer.Write([byte](0))
$writer.Write([byte](0))
$writer.Write([short](1))
$writer.Write([short](32))
$writer.Write([int]($pngBytes.Length))
$writer.Write([int](6 + 16))
$writer.Write($pngBytes)
$writer.Close()
[System.IO.File]::WriteAllBytes((Join-Path $outDir "icon.ico"), $ico.ToArray())
Write-Host "Created icon.ico"
