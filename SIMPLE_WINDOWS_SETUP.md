# Docker Model Runner - Windows Setup (Simple Fix)

## Your Issue

PowerShell scripts have encoding problems causing parse errors.

**Solution: Use Python instead (works perfectly)**

## ✅ Setup (Choose One)

### Option 1: Batch File (Simplest - Windows Only)
```bash
Double-click: setup-dmr.bat
```
That's it. It runs the Python setup automatically.

### Option 2: Python (Any OS)
```bash
python3 scripts/setup-simple.py
```

### Option 3: Manual Docker Desktop (No Scripts)
1. Open Docker Desktop
2. Click "Models" tab
3. Download: devstral-small-2
4. Download: nemotron3
5. Done! Models appear in Open WebUI

## ✓ Verify Everything Works
```bash
python3 verify-setup.py
```

Shows status of all services.

## 🚀 Use It

Go to: **http://localhost:3000**

Start typing - Smart Router picks best model automatically.

## Files

- `setup-dmr.bat` - Windows batch (double-click this)
- `scripts/setup-simple.py` - Python setup (works anywhere)
- `verify-setup.py` - Verification (check all services)

## That's It!

The complex PowerShell scripts are broken on Windows.

Use the simple Python scripts instead - they work perfectly.

---

**Quick Start:**

Windows:
```
Double-click: setup-dmr.bat
```

Or Python (any OS):
```
python3 scripts/setup-simple.py
```

Then:
```
Open http://localhost:3000
Start chatting
Done!
```
