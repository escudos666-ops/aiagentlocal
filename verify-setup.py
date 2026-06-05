#!/usr/bin/env python3
"""
Docker Model Runner - Verification Script
Check if everything is running
"""

import requests
import sys
import json

def check_service(url, name):
    """Check if a service is running"""
    try:
        response = requests.get(url, timeout=5)
        status = "OK" if response.status_code in [200, 204, 401, 403] else f"ERROR ({response.status_code})"
        print(f"  {name}: {status}")
        return True
    except requests.exceptions.ConnectionError:
        print(f"  {name}: FAILED (not running)")
        return False
    except Exception as e:
        print(f"  {name}: ERROR ({e})")
        return False

def main():
    print("\nDocker Model Runner - Verification\n")
    print("="*50)
    
    # Check all services
    services = [
        ("http://localhost:3000/api/health", "Open WebUI (3000)"),
        ("http://host.docker.internal:50051/v1/models", "DMR (50051)"),
        ("http://localhost:5678/api/v1/health", "N8N (5678)"),
        ("http://localhost:3100/api/health", "Grafana (3100)"),
        ("http://localhost:6379", "Redis (6379)"),
        ("http://localhost:5432", "PostgreSQL (5432)"),
    ]
    
    print("\nService Status:")
    print("-"*50)
    
    all_ok = True
    for url, name in services:
        if not check_service(url, name):
            all_ok = False
    
    print("="*50)
    
    if all_ok:
        print("\n✓ All services running!")
        print("\nOpen: http://localhost:3000")
        print("Start chatting - Smart Router works automatically\n")
        return 0
    else:
        print("\n✗ Some services not running")
        print("\nFix:")
        print("  1. Check: docker ps")
        print("  2. Restart: docker-compose restart")
        print("  3. Verify: docker-compose logs\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
