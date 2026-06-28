# Agentics GUI

Operational dashboard for the existing Agentics Docker stack.

## First check the backend data shape

Run this in PowerShell before starting frontend work:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/services | ConvertTo-Json -Depth 20
```

The dashboard normalizes common `/services` response shapes, including arrays, `{ services: [...] }`, and object maps.

## Local setup

```powershell
cd C:\DeerpShit\Agentics\agentics-gui
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## CORS handling

In development, browser calls to the tools API go through the Vite proxy:

```text
/api/tools -> VITE_TOOLS_API_URL
```

This avoids changing or restarting the `agentics-tools-api` container just to fix CORS.

## Build

```powershell
npm run build
npm run preview
```

## Project layout

```text
src/
  components/
    ErrorState.tsx
    QuickLinks.tsx
    ServiceCard.tsx
    ServiceDetail.tsx
    ServiceGrid.tsx
    StatusHeader.tsx
  config/
    services.ts
  lib/
    toolsApi.ts
  types/
    agentics.ts
  App.tsx
  main.tsx
  styles.css
```
