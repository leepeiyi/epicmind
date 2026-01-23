FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy all source code
COPY . .

# Don't copy uploads - they're mounted as a volume
RUN rm -rf uploads && mkdir uploads

EXPOSE 3000

CMD ["npm", "start"]
