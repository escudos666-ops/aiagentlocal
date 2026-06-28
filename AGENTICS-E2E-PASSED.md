# Agentics E2E Status

Date: 2026-06-07 03:25

Result: ALL E2E TESTS PASSED

Confirmed working:
- Containers running: gateway, Open WebUI DMR, n8n, WAHA, Postgres, Redis, Chroma, Tika, MinIO, PostGraphile, Adminer, n8n-imports
- Gateway URLs OK:
  - http://ai.localhost
  - http://n8n.localhost
  - http://db.localhost
  - http://files.localhost
  - http://graphql.localhost/graphql
- Docker Model Runner OK:
  - tags HTTP 200
  - chat inference HTTP 200
  - llama3.2 listed
  - qwen2.5 listed
- WAHA OK:
  - session default WORKING
  - n8n can reach WAHA
  - WhatsApp send test available with -SendWhatsApp
- Data services OK:
  - Postgres pg_isready
  - Redis PONG
  - Chroma heartbeat HTTP 200
  - Tika HTTP 200
  - MinIO health HTTP 200
  - PostGraphile GraphQL HTTP 200

E2E script:
C:\DeerpShit\Agentics\scripts\e2e-agentics.ps1

Reports:
C:\DeerpShit\Agentics\test-reports\
