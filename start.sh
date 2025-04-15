#!/bin/sh
# Wait for PostgreSQL using pg_isready with retries
DB_HOST=$(echo $DATABASE_URL | awk -F[@] '{print $2}' | awk -F[:/] '{print $1}')
DB_PORT=$(echo $DATABASE_URL | awk -F[@] '{print $2}' | awk -F[:/] '{print $2}')
DB_USER=$(echo $DATABASE_URL | awk -F[:/@] '{print $4}')

echo "Waiting for database at $DB_HOST:$DB_PORT..."
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  sleep 2
done

npx prisma migrate deploy
node src/index.js