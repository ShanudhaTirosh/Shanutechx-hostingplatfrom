FROM node:22-alpine

# iputils provides a robust `ping` binary for ICMP monitors (needs NET_RAW capability at runtime).
# python3, make, g++ for sqlite3 native compilation if needed on alpine musl.
RUN apk add --no-cache iputils python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3003
RUN npm run build

EXPOSE 3003
CMD ["npm", "start"]
