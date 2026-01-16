# Dockerfile for VBStats backend - optimized for Render
FROM node:18-alpine

# create app directory
WORKDIR /usr/src/app

# install dependencies (using package-lock if present)
COPY package*.json ./
RUN npm ci --only=production

# copy application code
COPY . .

# Default port; Render will inject $PORT at runtime if set
ENV PORT=4000
EXPOSE 4000

# Start the app (assumes entry point is index.js)
CMD ["node", "index.js"]
