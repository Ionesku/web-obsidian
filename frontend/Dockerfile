FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use install instead of ci to regenerate lock file)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Debug: List files to verify copy
RUN ls -la src/lib/codemirror/ || echo "codemirror directory not found!"
RUN echo "Checking for search-highlight.ts:"
RUN ls -la src/lib/codemirror/search-highlight.ts || echo "search-highlight.ts NOT FOUND!"

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
