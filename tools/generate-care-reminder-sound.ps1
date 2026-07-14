param(
  [string]$OutputPath = "assets/audio/baby_reminder.wav"
)

$sampleRate = 22050
$notes = @(
  @{ Frequency = 659.25; Duration = 0.18; Volume = 0.24 },
  @{ Frequency = 783.99; Duration = 0.18; Volume = 0.22 },
  @{ Frequency = 987.77; Duration = 0.34; Volume = 0.20 }
)
$samples = New-Object System.Collections.Generic.List[int16]

foreach ($note in $notes) {
  $count = [int]($sampleRate * $note.Duration)
  for ($i = 0; $i -lt $count; $i++) {
    $progress = $i / [double]$count
    $envelope = [Math]::Sin([Math]::PI * $progress) * [Math]::Exp(-2.2 * $progress)
    $wave = [Math]::Sin(2 * [Math]::PI * $note.Frequency * $i / $sampleRate)
    $samples.Add([int16]($wave * $envelope * $note.Volume * [int16]::MaxValue))
  }
}

$absolutePath = Join-Path (Get-Location) $OutputPath
$directory = Split-Path -Parent $absolutePath
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$stream = [System.IO.File]::Create($absolutePath)
$writer = New-Object System.IO.BinaryWriter($stream)
$dataSize = $samples.Count * 2

$writer.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
$writer.Write([int](36 + $dataSize))
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
$writer.Write([int]16)
$writer.Write([int16]1)
$writer.Write([int16]1)
$writer.Write([int]$sampleRate)
$writer.Write([int]($sampleRate * 2))
$writer.Write([int16]2)
$writer.Write([int16]16)
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
$writer.Write([int]$dataSize)
foreach ($sample in $samples) { $writer.Write($sample) }
$writer.Dispose()
$stream.Dispose()

Write-Output $absolutePath
