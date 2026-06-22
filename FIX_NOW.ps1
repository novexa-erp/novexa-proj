# Quick Fix Script - Run This Now!
# Save this file and run in PowerShell

Write-Host "🔧 Fixing Git Authentication Issue..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Clear cached credentials
Write-Host "Step 1: Clearing cached GitHub credentials..." -ForegroundColor Yellow
cmdkey /list | Select-String "github" | ForEach-Object { 
    $target = ($_ -replace '.*Target: ', '').Trim()
    Write-Host "  Removing: $target" -ForegroundColor Gray
    cmdkey /delete:$target 2>$null
}
Write-Host "  ✓ Credentials cleared" -ForegroundColor Green
Write-Host ""

# Step 2: Configure Git to prompt for credentials
Write-Host "Step 2: Configuring Git credential manager..." -ForegroundColor Yellow
git config --global credential.helper manager
git config --global credential.useHttpPath true
git config --global credential.modalPrompt true
Write-Host "  ✓ Git configured" -ForegroundColor Green
Write-Host ""

# Step 3: Check current remote
Write-Host "Step 3: Checking remote URL..." -ForegroundColor Yellow
$remote = git remote get-url origin
Write-Host "  Current: $remote" -ForegroundColor Gray

if ($remote -notlike "https://*") {
    Write-Host "  Updating to HTTPS URL..." -ForegroundColor Gray
    git remote set-url origin https://github.com/novexa-erp/novexa-proj.git
    Write-Host "  ✓ Remote URL updated" -ForegroundColor Green
} else {
    Write-Host "  ✓ Remote URL is correct" -ForegroundColor Green
}
Write-Host ""

# Step 4: Check current user config
Write-Host "Step 4: Checking Git user configuration..." -ForegroundColor Yellow
$userName = git config user.name
$userEmail = git config user.email
Write-Host "  Name: $userName" -ForegroundColor Gray
Write-Host "  Email: $userEmail" -ForegroundColor Gray
Write-Host ""

# Step 5: Ready to push
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run this command:" -ForegroundColor Cyan
Write-Host "  git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "A popup will appear - select your Novexa GitHub account!" -ForegroundColor Yellow
Write-Host ""
Write-Host "If no popup appears, run:" -ForegroundColor Cyan
Write-Host "  git credential reject" -ForegroundColor White
Write-Host "  Then type: protocol=https" -ForegroundColor White
Write-Host "  Then type: host=github.com" -ForegroundColor White
Write-Host "  Press Enter twice, then push again" -ForegroundColor White
