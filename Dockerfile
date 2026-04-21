# Двухстадийная сборка: компилируем TypeScript в «build»-образе, затем
# копируем только нужные артефакты в лёгкий runtime-образ. Это держит
# финальный образ маленьким и без dev-зависимостей.

FROM node:20-alpine AS build
WORKDIR /app

# Query-engine Prisma линкуется с OpenSSL в runtime. node:20-alpine
# его больше не приносит — ставим явно в обеих стадиях.
RUN apk add --no-cache openssl

# Сначала ставим зависимости, чтобы Docker мог закешировать слой
# при изменении только исходников.
COPY package.json package-lock.json* ./
RUN npm install

# Prisma-схему копируем до генерации клиента — генератор читает
# schema.prisma и кладёт код в node_modules/@prisma/client.
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build


FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL также нужен в runtime для query-engine Prisma и для
# `prisma migrate deploy` при старте контейнера.
RUN apk add --no-cache openssl

# Runtime-образ несёт package.json, node_modules (со сгенерированным
# клиентом Prisma), собранный JS и схему Prisma (нужна `migrate deploy`).
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/index.js"]
