# Export every slide of the PDI deck to PNG, by driving PowerPoint over COM.
#
#   powershell.exe -File export_slides.ps1 -Source C:\path\pdi.pptx -Out C:\path\out
#
# This is the only path that renders the deck the way the deck actually looks.
# LibreOffice substitutes the two Itaú corporate faces that carry 82,5% of the
# characters, so its render measures a font nobody has -- which is exactly the
# defect this corpus exists to avoid.
#
# FROM WSL, the two paths must be visible to WINDOWS, not to Linux. `\\wsl$\...`
# is refused by the COM object often enough that copying is the reliable move:
#
#   cp deck.pptx /mnt/c/Users/<you>/AppData/Local/Temp/pdi.pptx
#   powershell.exe -File $(wslpath -w ./export_slides.ps1) `
#       -Source 'C:\Users\<you>\AppData\Local\Temp\pdi.pptx' `
#       -Out    'C:\Users\<you>\AppData\Local\Temp\pdiexport'
#   cp /mnt/c/Users/<you>/AppData/Local/Temp/pdiexport/*.PNG ./slides/
#
# 1600x900 is deliberate: the deck's box is 16:9 exactly (9144000 x 5143500 EMU),
# so the export neither letterboxes nor resamples the aspect. It writes
# `Slide1.PNG` .. `SlideN.PNG`, which is the naming `build_reference.py` expects.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Width  = 1600,
  [int]$Height = 900
)

$ErrorActionPreference = "Stop"

$app = New-Object -ComObject PowerPoint.Application
try {
  # Open read-only, untitled, without a window.
  $pres = $app.Presentations.Open($Source, $true, $false, $false)
  Write-Output ("SLIDES=" + $pres.Slides.Count)
  Write-Output ("BOX_PT=" + $pres.PageSetup.SlideWidth + "x" + $pres.PageSetup.SlideHeight)
  $pres.Export($Out, "PNG", $Width, $Height)
  $pres.Close()
  Write-Output "EXPORT_OK"
}
finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}
