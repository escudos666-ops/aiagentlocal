import sqlite3

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Update the role from 'pending' to 'admin'
cursor.execute("UPDATE user SET role = 'admin' WHERE email = 'admin@localhost'")
conn.commit()

# Verify the update
cursor.execute("SELECT id, name, email, role FROM user WHERE email = 'admin@localhost'")
users = cursor.fetchall()
print('Updated users:')
for user in users:
    print(user)

conn.close()
print('Account activation complete!')
