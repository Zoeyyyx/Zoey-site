param(
  [string]$EnvPath = ".env",
  [string]$OutputPath = "js/lib/runtime-config.js"
)

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "Cannot find env file: $EnvPath"
}

$values = @{}

Get-Content -LiteralPath $EnvPath -Encoding UTF8 | ForEach-Object {
  $line = $_.Trim()

  if (-not $line -or $line.StartsWith("#")) {
    return
  }

  $parts = $line -split "=", 2
  if ($parts.Count -ne 2) {
    return
  }

  $key = $parts[0].Trim()
  $value = $parts[1].Trim().Trim("'").Trim('"')
  $values[$key] = $value
}

$supabaseUrl = $values["SUPABASE_URL"]
$supabaseAnonKey = $values["SUPABASE_ANON_KEY"]
$siteBasePath = $values["SITE_BASE_PATH"]

if (-not $supabaseUrl -or -not $supabaseAnonKey) {
  throw "SUPABASE_URL and SUPABASE_ANON_KEY are required in $EnvPath"
}

$escape = {
  param([string]$InputValue)
  return $InputValue.Replace("\", "\\").Replace("'", "\'")
}

$content = @"
window.__ZOEY_SITE_CONFIG__ = Object.freeze({
  SITE_BASE_PATH: '$(& $escape $siteBasePath)',
  SUPABASE_URL: '$(& $escape $supabaseUrl)',
  SUPABASE_ANON_KEY: '$(& $escape $supabaseAnonKey)'
});
"@

Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
Write-Host "Wrote public runtime config to $OutputPath"
