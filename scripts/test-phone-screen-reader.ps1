param(
  [Parameter(Mandatory=$true)][string]$Serial,
  [Parameter(Mandatory=$true)][string]$Service,
  [ValidateSet('en','zh-CN')][string]$Language='en'
)
$ErrorActionPreference='Stop'
if($Serial -notmatch '^[A-Za-z0-9_.:-]+$'){throw 'Invalid device serial'}
if($Service -notmatch '^[A-Za-z0-9_.]+/[A-Za-z0-9_.$]+$'){throw 'Invalid accessibility component'}
$adb=Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
function PhoneAdb([string[]]$Arguments) {
  $result=& $adb -s $Serial @Arguments
  if($LASTEXITCODE -ne 0){throw "ADB failed: $($Arguments[0])"}
  return ($result -join "`n").Trim()
}
if($Serial.StartsWith('emulator-')){throw 'A physical device is required'}
if((PhoneAdb -Arguments @('shell','am','get-current-user')) -ne '0'){throw 'This runner is scoped to the owner profile'}
$original=@{}
foreach($key in @('enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled')){
  $original[$key]=PhoneAdb -Arguments @('shell','settings','--user','0','get','secure',$key)
}
$qaPackage='com.legendarycookie.lingopractice.qa'
if(!(PhoneAdb -Arguments @('shell','pm','path','--user','0',$qaPackage)).StartsWith('package:')){throw 'Install the separate QA app first'}
$services=if($original.enabled_accessibility_services -eq 'null'){''}else{$original.enabled_accessibility_services}
$enabled=@($services.Split(':') | Where-Object {$_})
if($enabled -notcontains $Service){$enabled+=@($Service)}
$outputPath=Join-Path $PSScriptRoot "..\.browser-qa\talkback-$Language.log"
try {
  PhoneAdb -Arguments @('shell','settings','--user','0','put','secure','enabled_accessibility_services',($enabled -join ':')) | Out-Null
  PhoneAdb -Arguments @('shell','settings','--user','0','put','secure','accessibility_enabled','1') | Out-Null
  Start-Sleep -Seconds 3
  $result=PhoneAdb -Arguments @('shell','am','instrument','--user','0','-w','-e','language',$Language,'com.legendarycookie.lingopractice.qa.test/com.legendarycookie.lingopractice.PhoneAccessibilityInstrumentation')
  $result | Set-Content -LiteralPath $outputPath
  Write-Output $result
  if($result -notmatch 'INSTRUMENTATION_CODE: 0'){throw 'TalkBack check failed; see its output'}
} finally {
  foreach($key in @('enabled_accessibility_services','accessibility_enabled','touch_exploration_enabled')){
    if($original[$key] -eq 'null'){PhoneAdb -Arguments @('shell','settings','--user','0','delete','secure',$key) | Out-Null}
    else{PhoneAdb -Arguments @('shell','settings','--user','0','put','secure',$key,$original[$key]) | Out-Null}
  }
  foreach($key in $original.Keys){if((PhoneAdb -Arguments @('shell','settings','--user','0','get','secure',$key)) -ne $original[$key]){throw "Accessibility setting was not restored: $key"}}
  Write-Output 'RESTORED original accessibility settings'
}
