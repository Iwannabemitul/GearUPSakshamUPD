# Verify the ZIP contains no secrets or build artifacts.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead("C:\Users\Mitul\.zcode\workspace\default\my-project\download\saksham-multilingual.zip")
$names = $zip.Entries | Select-Object -ExpandProperty FullName
$zip.Dispose()
$bad = $names | Where-Object { $_ -match "(^|/)\.env$|dev\.db|node_modules|\.log$|\.next/" }
Write-Output ("total files: " + $names.Count)
if ($bad) { Write-Output "SUSPICIOUS:"; $bad } else { Write-Output "SCRUB-CHECK: CLEAN" }
