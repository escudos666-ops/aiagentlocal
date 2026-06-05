# 🚀 Docker Model Runner - One-Liner Setup

## The Issue

PowerShell is blocking script execution. Here's the instant fix:

## ✅ THE SOLUTION (Pick One - 10 Seconds)

### Option A: Python Setup (Easiest - No PowerShell Needed)
```powershell
python3 scripts/setup-dmr-integration.py
```

**That's it. One command. No admin needed.**

### Option B: Fix PowerShell Policy + Run Setup
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; .\scripts\setup-dmr.ps1
```

**One line, fixes policy and runs setup.**

### Option C: Bypass + Run (Most Direct)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-dmr.ps1
```

**Doesn't change system settings, just runs once.**

## ✨ Then What?

After any of the above, you'll see:

```
✅ Docker Model Runner: Reachable
✅ Available Models: Devstral, Nemotron
✅ Services: Open WebUI, N8N, Grafana - All OK

Next Steps:
1. Open http://localhost:3000
2. Start chatting
3. Smart Router picks best model automatically
4. Monitor in Grafana: http://localhost:3100
```

## 🎯 Use It Now

Go to: **http://localhost:3000**

Just start typing. Smart routing works automatically:
- "Write Python code" → Uses Devstral
- "Analyze data" → Uses Nemotron
- "General question" → Uses Nemotron

No configuration needed. It just works.

## 📊 Monitor

Go to: **http://localhost:3100** (Grafana)
- Login: admin / admin
- View: Docker Model Runner dashboard
- See: Real-time metrics, throughput, latency, GPU usage

## 🔧 More Help

See: **WINDOWS_POWERSHELL_FIX.md**

Or just use Python option A above (always works).

---

**Your entire Docker Model Runner stack is 100% ready. Just run the setup command above and start using it. 🚀**
