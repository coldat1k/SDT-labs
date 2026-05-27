#!/bin/bash

# Перевірка на виконання від імені root
if [ "$EUID" -ne 0 ]; then
  echo "Будь ласка, запустіть скрипт з правами root (sudo ./setup.sh)"
  exit 1
fi

echo "1. Встановлення пакетів..."
apt-get update
apt-get install -y nginx postgresql postgresql-contrib nodejs npm

echo "2. Створення користувачів..."
useradd -m -s /bin/bash -G sudo student
echo "student:12345678" | chpasswd
chage -d 0 student

useradd -m -s /bin/bash -G sudo teacher
echo "teacher:12345678" | chpasswd
chage -d 0 teacher

useradd -m -s /bin/bash operator
echo "operator:12345678" | chpasswd
chage -d 0 operator

useradd -r -s /bin/false app

cat <<EOF > /etc/sudoers.d/operator
operator ALL=(ALL) NOPASSWD: /bin/systemctl start mywebapp, /bin/systemctl stop mywebapp, /bin/systemctl restart mywebapp, /bin/systemctl status mywebapp, /bin/systemctl reload nginx
EOF
chmod 0440 /etc/sudoers.d/operator

echo "3. Налаштування бази даних PostgreSQL..."
sudo -u postgres psql -c "CREATE USER app WITH PASSWORD 'app_password';"
sudo -u postgres psql -c "CREATE DATABASE inventory_db OWNER app;"

echo "4. Підготовка директорії застосунку та конфігурації..."
mkdir -p /opt/mywebapp
mkdir -p /etc/mywebapp

cat <<EOF > /etc/mywebapp/config.json
{
  "port": 8000,
  "db": {
    "user": "app",
    "host": "127.0.0.1",
    "database": "inventory_db",
    "password": "app_password",
    "port": 5432
  }
}
EOF

cp app.js migrate.js package.json /opt/mywebapp/
cd /opt/mywebapp
npm install

chown -R app:app /opt/mywebapp
chown -R app:app /etc/mywebapp

echo "5. Налаштування systemd-unit..."
cat <<EOF > /etc/systemd/system/mywebapp.service
[Unit]
Description=Simple Inventory Web App
After=network.target postgresql.service

[Service]
Type=simple
User=app
WorkingDirectory=/opt/mywebapp
ExecStartPre=/usr/bin/node /opt/mywebapp/migrate.js
ExecStart=/usr/bin/node /opt/mywebapp/app.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mywebapp
systemctl start mywebapp

echo "6. Налаштування Nginx..."
cat <<EOF > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Віддаємо лише кореневий ендпоінт та бізнес-логіку
    location = / {
        proxy_pass http://127.0.0.1:8000;
    }

    location /items {
        proxy_pass http://127.0.0.1:8000;
    }

    # Блокуємо доступ до health-чеків та інших шляхів ззовні
    location / {
        return 403;
    }
}
EOF

systemctl restart nginx

echo "7. Створення файлу gradebook..."
echo "23" > /home/student/gradebook
chown student:student /home/student/gradebook

echo "8. Блокування дефолтного користувача..."
if [ -n "$SUDO_USER" ]; then
    usermod -L "$SUDO_USER"
    echo "Користувача $SUDO_USER заблоковано."
fi

echo "Розгортання завершено успішно!"