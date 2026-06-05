import sqlite3
import sys

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]
print('Tables found:', tables)

# Look for user-related tables
for table in tables:
    if 'user' in table.lower() or 'auth' in table.lower():
        cursor.execute(f'PRAGMA table_info({table})')
        columns = [row[1] for row in cursor.fetchall()]
        print(f'{table}: {columns}')

# Try to find the auth table and check its contents
if 'auth' in tables:
    cursor.execute('SELECT * FROM auth LIMIT 1')
    print('Auth table sample:', cursor.fetchone())

conn.close()
