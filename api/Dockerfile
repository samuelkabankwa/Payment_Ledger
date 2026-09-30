FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

COPY package.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

EXPOSE 3001

CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate && npm run dev"]
