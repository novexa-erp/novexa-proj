# 🔧 Git Multiple Account Setup - Complete Solution

## ✅ Problem Solved: Har Project Mein Account Select Kar Sakein

---

## 🚀 Quick Fix - Ab Kaam Karein

### Step 1: Git Credential Manager Install Karein (Agar nahi hai)

```powershell
# Check if already installed
git credential-manager --version

# If not installed, download from:
# https://github.com/git-ecosystem/git-credential-manager/releases/latest
```

### Step 2: Git Config Update (Global Settings)

```powershell
# Open PowerShell and run these commands:

# Remove cached credentials for this repo
git credential reject
# Then paste this and press Enter twice:
protocol=https
host=github.com

# Configure Git to always ask for credentials
git config --global credential.helper manager

# Enable credential prompt
git config --global credential.useHttpPath true

# Disable credential caching (optional)
git config --global credential.modalPrompt true
```

### Step 3: Current Project Ke Liye Remote URL Update

```powershell
# HTTPS URL set karein (jo popup show karega)
git remote set-url origin https://github.com/novexa-erp/novexa-proj.git

# Verify
git remote -v
```

### Step 4: Saved Credentials Clear Karein

```powershell
# Windows Credential Manager se purane credentials delete karein
# Method 1: PowerShell se
cmdkey /list | Select-String "github" | ForEach-Object { cmdkey /delete:($_ -replace '.*Target: ') }

# Method 2: Manual (Recommended)
# 1. Windows key press karein
# 2. "Credential Manager" search karein
# 3. Open karein
# 4. "Windows Credentials" section
# 5. GitHub related sare credentials delete karein
```

### Step 5: Test Push (Popup Aayega)

```powershell
# Ab push karein
git push -u origin main

# Popup aayega authentication ke liye!
# 1. Select "Sign in with your browser"
# 2. GitHub login page khulega
# 3. Jo account use karna hai wo select karein
# 4. Done!
```

---

## 🎯 Per-Project Account Setup (Best Method)

Har project mein alag account automatically use ho:

### Option A: Per-Repository Config (Recommended)

```powershell
# Har project ki directory mein jaa kar ye commands run karein:

# Set specific user for this project
git config user.name "Your Name"
git config user.email "your-email@example.com"

# Verify
git config user.name
git config user.email
```

### Option B: Conditional Git Config (Advanced)

Create/Edit: `C:\Users\YourUsername\.gitconfig`

```ini
[user]
    name = Default Name
    email = default@email.com

[credential]
    helper = manager
    useHttpPath = true

# Project 1 - Novexa
[includeIf "gitdir:D:/novexa-proj/"]
    path = ~/.gitconfig-novexa

# Project 2 - Other Account
[includeIf "gitdir:D:/other-project/"]
    path = ~/.gitconfig-other
```

Create: `C:\Users\YourUsername\.gitconfig-novexa`

```ini
[user]
    name = Novexa Developer
    email = novexa@email.com
[credential]
    username = novexa-erp
```

Create: `C:\Users\YourUsername\.gitconfig-other`

```ini
[user]
    name = Other Account
    email = other@email.com
[credential]
    username = ayazahmadacademy3-stack
```

---

## 🔑 SSH Key Method (Most Secure - No Popup Needed)

Har account ke liye alag SSH key:

### Step 1: SSH Keys Generate Karein

```powershell
# Account 1 - Novexa
ssh-keygen -t ed25519 -C "novexa@email.com" -f ~/.ssh/id_ed25519_novexa

# Account 2 - Personal
ssh-keygen -t ed25519 -C "personal@email.com" -f ~/.ssh/id_ed25519_personal

# No passphrase chahiye to just Enter press karein
```

### Step 2: SSH Config File Banayein

Create/Edit: `C:\Users\YourUsername\.ssh\config`

```
# Novexa Account
Host github-novexa
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_novexa
    IdentitiesOnly yes

# Personal Account
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
```

### Step 3: SSH Keys GitHub Mein Add Karein

```powershell
# Copy public key
Get-Content ~/.ssh/id_ed25519_novexa.pub | Set-Clipboard

# Ab GitHub mein:
# 1. Login karein (Novexa account)
# 2. Settings → SSH and GPG keys
# 3. New SSH key
# 4. Paste karein
# 5. Save

# Repeat for other account
```

### Step 4: Remote URL Change Karein (SSH)

```powershell
# For Novexa project
git remote set-url origin git@github-novexa:novexa-erp/novexa-proj.git

# For Personal project (example)
# git remote set-url origin git@github-personal:username/repo.git

# Verify
git remote -v
```

### Step 5: Test

```powershell
# Test connection
ssh -T git@github-novexa
# Should show: Hi novexa-erp! You've successfully authenticated...

# Push without popup!
git push -u origin main
```

---

## 🎯 Current Issue Fix (Fastest Solution)

```powershell
# Run these commands in PowerShell in your project directory:

# Step 1: Clear cached wrong credentials
git credential reject
# Then type these lines and press Enter twice:
protocol=https
host=github.com

# Step 2: Try push again (popup should appear)
git push -u origin main

# If still error, force re-authentication:
git config --local credential.helper ""
git push -u origin main
# Popup will ask for credentials - select correct account
```

---

## 🔍 Troubleshooting

### Issue 1: Still showing 403 error
```powershell
# Remove all GitHub credentials
cmdkey /list | Select-String "github" | ForEach-Object { 
    $target = ($_ -replace '.*Target: ').Trim()
    cmdkey /delete:$target
}

# Try again
git push -u origin main
```

### Issue 2: Wrong account keeps getting used
```powershell
# Check current config
git config --list | Select-String "user|credential"

# Set correct user for this project
git config user.name "Novexa Developer"
git config user.email "novexa@email.com"

# Force credential prompt
git config credential.helper manager
git config credential.useHttpPath true
```

### Issue 3: No popup appearing
```powershell
# Enable modal prompt
git config --global credential.modalPrompt true

# Or use browser-based auth
git config --global credential.helper manager-core
```

---

## 📱 GitHub Desktop Alternative

Agar command line mushkil lag raha hai:

1. **Download GitHub Desktop**: https://desktop.github.com
2. Install karein
3. **File → Options → Accounts**
4. Multiple accounts add kar sakte hain
5. Har push par account select karne ka option milega

---

## ✅ Best Practice (Recommendation)

### For Your Use Case (Multiple Projects):

**Use SSH Keys Method** - One-time setup, lifetime benefit:

1. ✅ No popups needed
2. ✅ Automatic account switching per project
3. ✅ Most secure
4. ✅ Works with all Git operations
5. ✅ No password needed

**Setup Time:** 10 minutes
**Future Effort:** 0 minutes

---

## 🎯 Quick Command Reference

```powershell
# Clear all GitHub credentials
cmdkey /list | Select-String "github" | ForEach-Object { cmdkey /delete:($_ -replace '.*Target: ').Trim() }

# Force new login
git credential reject
git push -u origin main

# Check current user
git config user.name
git config user.email

# Set user for current project
git config user.name "Your Name"
git config user.email "your@email.com"

# Switch to SSH (after SSH setup)
git remote set-url origin git@github-novexa:novexa-erp/novexa-proj.git
```

---

## 📞 Need Help?

Run these commands and check output:

```powershell
# Check Git version
git --version

# Check credential helper
git config --get credential.helper

# Check remote URL
git remote -v

# Check saved credentials
cmdkey /list | Select-String "github"

# Check current user
git config user.name
git config user.email
```

---

**Status:** Ready to implement! Choose your preferred method above. 🚀

**Recommendation:** Use SSH Keys Method for permanent solution!
