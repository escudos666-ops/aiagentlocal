# FIXED - Docker Model Runner Simple Setup

## The Problem

PowerShell scripts have encoding/character encoding issues on Windows.

**Solution: Use Python instead (100% reliable)**

---

## ✅ NEW Simple Setup (Just Use These)

### For Windows Users (Easiest)
```bash
# Double-click this file:
setup-dmr.bat
```

That's it. Runs automatically.

### For Any OS (Python)
```bash
python3 scripts/setup-simple.py
```

### Verify Everything
```bash
python3 verify-setup.py
```

---

## 🎯 What These Do

**setup-dmr.bat** (Windows)
- Checks Python is installed
- Runs Python setup
- Shows results
- Done!

**setup-simple.py** (Any OS)
- Tests Docker Model Runner connection
- Lists available models
- Checks Open WebUI, N8N, Grafana
- Shows next steps

**verify-setup.py** (Any OS)
- Checks all services running
- Shows status (OK or FAILED)
- Simple status report

---

## Usage

### Step 1: Run Setup

**Windows:**
```
Double-click: setup-dmr.bat
```

**Or Python:**
```
python3 scripts/setup-simple.py
```

### Step 2: Verify
```
python3 verify-setup.py
```

Should show:
```
✓ Open WebUI: OK
✓ DMR: OK
✓ N8N: OK
✓ Grafana: OK
```

### Step 3: Use It
```
Open: http://localhost:3000
Start typing
Smart Router picks best model automatically
```

---

## No More PowerShell Issues!

Old PowerShell scripts = encoding problems = parse errors

New Python scripts = simple, clean, reliable = works everywhere

---

## Files You Need

✅ `setup-dmr.bat` - Windows setup (double-click)
✅ `scripts/setup-simple.py` - Python setup
✅ `verify-setup.py` - Verification

**That's all you need.**

The complex PowerShell and .ps1 files can be ignored.

---

## If Something Fails

### Docker Model Runner not reachable
```
1. Open Docker Desktop
2. Click "Models" tab
3. Download: devstral-small-2 and nemotron3
4. Wait 1 minute
5. Run verification again
```

### Services not starting
```
docker-compose up -d
docker-compose ps
```

### Check status
```
python3 verify-setup.py
```

---

## Done!

Your Docker Model Runner setup is **simplified and working**.

**Start now:**

Windows:
```
Double-click: setup-dmr.bat
```

Any OS:
```
python3 scripts/setup-simple.py
```

**Then:**
```
http://localhost:3000
```

**Smart Router works automatically!**
