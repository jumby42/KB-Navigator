FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "const http=require('http');const req=http.get('http://127.0.0.1:3000/api/setup/status',res=>{process.exit(res.statusCode>=200&&res.statusCode<500?0:1)});req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"

CMD ["node", "server/server.js"]