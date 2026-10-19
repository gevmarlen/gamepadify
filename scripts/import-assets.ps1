$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskZipPath = Join-Path $taskRoot '.artifacts/input-prompts.zip'
$taskAssetPath = Join-Path $taskRoot 'packages/core/assets'
New-Item -ItemType Directory -Force -Path (Split-Path $taskZipPath),$taskAssetPath | Out-Null
if (!(Test-Path -LiteralPath $taskZipPath)) {
    Invoke-WebRequest -Uri 'https://kenney.nl/media/pages/assets/input-prompts/8de120163f-1783763952/kenney_input-prompts_1.5.zip' -OutFile $taskZipPath
}
if ((Get-FileHash -LiteralPath $taskZipPath).Hash -ne 'AC2FCF599080B0F3BA2D174C9474DB6DF1A0E96FF0662580E2DA79A122AB78A1') { throw 'Unexpected asset archive checksum.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive = [System.IO.Compression.ZipFile]::OpenRead($taskZipPath)
$taskButtons = @('south','east','west','north','left-shoulder','right-shoulder','left-trigger','right-trigger','select','start','left-stick','right-stick','dpad-up','dpad-down','dpad-left','dpad-right','home')
$taskSets = [ordered]@{
    xbox = @{ folder = 'Xbox Series'; files = @('xbox_button_color_a','xbox_button_color_b','xbox_button_color_x','xbox_button_color_y','xbox_lb','xbox_rb','xbox_lt','xbox_rt','xbox_button_view','xbox_button_menu','xbox_ls','xbox_rs','xbox_dpad_up','xbox_dpad_down','xbox_dpad_left','xbox_dpad_right','xbox_guide') }
    playstation = @{ folder = 'PlayStation Series'; files = @('playstation_button_color_cross','playstation_button_color_circle','playstation_button_color_square','playstation_button_color_triangle','playstation_trigger_l1','playstation_trigger_r1','playstation_trigger_l2','playstation_trigger_r2','playstation5_button_create','playstation5_button_options','playstation_button_l3','playstation_button_r3','playstation_dpad_up','playstation_dpad_down','playstation_dpad_left','playstation_dpad_right',$null) }
    switch = @{ folder = 'Nintendo Switch'; files = @('switch_button_b','switch_button_a','switch_button_y','switch_button_x','switch_button_l','switch_button_r','switch_button_zl','switch_button_zr','switch_button_minus','switch_button_plus','switch_stick_l_press','switch_stick_r_press','switch_dpad_up','switch_dpad_down','switch_dpad_left','switch_dpad_right','switch_button_home') }
}
$taskManifest = [ordered]@{}
foreach ($taskFamily in $taskSets.Keys) {
    $taskSet = $taskSets[$taskFamily]
    $taskManifest[$taskFamily] = [ordered]@{}
    for ($taskIndex = 0; $taskIndex -lt $taskButtons.Length; $taskIndex++) {
        $taskFile = $taskSet.files[$taskIndex]
        if (!$taskFile) { continue }
        $taskEntry = $taskArchive.GetEntry("$($taskSet.folder)/Default/$taskFile.png")
        if (!$taskEntry) { throw "Missing asset: $taskFile" }
        $taskOutputName = "$taskFamily-$($taskButtons[$taskIndex]).png"
        [System.IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry, (Join-Path $taskAssetPath $taskOutputName), $true)
        $taskManifest[$taskFamily][$taskButtons[$taskIndex]] = $taskOutputName
    }
}
$taskLicense = $taskArchive.Entries | Where-Object { $_.FullName -match 'License.txt$' } | Select-Object -First 1
[System.IO.Compression.ZipFileExtensions]::ExtractToFile($taskLicense, (Join-Path $taskAssetPath 'LICENSE.txt'), $true)
$taskArchive.Dispose()
[System.IO.File]::WriteAllText((Join-Path $taskAssetPath 'manifest.json'), ($taskManifest | ConvertTo-Json -Depth 3), [System.Text.UTF8Encoding]::new($false))
Write-Output 'Imported 50 unmodified PNGs and the original CC0 notice.'
