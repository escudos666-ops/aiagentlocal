# Windows PowerShell Host Bridge - Later Phase

This is NOT enabled for MVP.

## Purpose

Allow the PA agent to run carefully controlled PowerShell commands on the Windows host.

## Default scope

Working directory:

C:\DeerpShit\Agentics

Bind address:

127.0.0.1 only

## Allowed without approval

- Get-Location
- Get-ChildItem
- Get-Process
- Get-Service
- docker ps
- docker logs --tail 100
- git status

## Requires approval

- Set-Content
- New-Item
- Remove-Item
- Move-Item
- docker compose up
- docker compose down
- docker compose restart
- npm install
- pip install
- winget install
- editing .env
- editing compose files

## Blocked

- reading secret values
- deleting Docker volumes
- formatting disks
- changing firewall rules
- disabling Defender
- exposing services on 0.0.0.0

## Required controls

- API key
- localhost binding only
- command allowlist
- approval queue
- Postgres audit log
- no raw unrestricted shell
