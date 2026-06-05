import sqlite3

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Check config table
cursor.execute("SELECT * FROM config")
configs = cursor.fetchall()
print('Config entries:')
for config in configs:
    print(config)

# Check user table for admin
cursor.execute("SELECT * FROM user WHERE email LIKE '%admin%'")
users = cursor.fetchall()
print('\nAdmin users:')
for user in users:
    print(user)

conn.close()
