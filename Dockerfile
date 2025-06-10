# Use a node image as the base for building
FROM node:21-alpine AS builder

# Set the working directory
WORKDIR /usr/src/app

# Set NODE_OPTIONS to match t3.micro constraints
ENV NODE_OPTIONS="--max_old_space_size=2048"

# Install build dependencies for bcrypt
RUN apk add --no-cache python3 make g++

# Copy package files first to utilize layer caching
COPY package.json pnpm-lock.yaml ./

# Copy only necessary config files
COPY tsconfig.json tsconfig.build.json nest-cli.json ./

# Install pnpm (pin to 8.12.1 for lockfile compatibility)
RUN npm install -g pnpm@8.12.1

# Install node-gyp and bcrypt globally
RUN npm install -g node-gyp
RUN npm install -g bcrypt
# Compile bcrypt manually
RUN npm rebuild bcrypt

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code (after dependencies are installed to leverage caching)
COPY . .

# Build the application
RUN pnpm run build

# Use a much smaller base image for the final stage
FROM node:21-alpine AS production

# Set working directory
WORKDIR /usr/src/app

COPY . .

# Set NODE_OPTIONS for runtime
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=512"

# Install build dependencies for bcrypt
RUN apk add --no-cache python3 make g++

# Copy only the necessary files from the builder stage
COPY --from=builder /usr/src/app/dist ./dist/
COPY --from=builder /usr/src/app/node_modules ./node_modules/


# Install pnpm (pin to 8.12.1 for lockfile compatibility)
RUN npm install -g pnpm@8.12.1

# Install node-gyp and bcrypt globally
RUN npm install -g node-gyp
RUN npm install -g bcrypt
# Compile bcrypt manually
RUN npm rebuild bcrypt

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod=true

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose application port
EXPOSE 3030

# Use non-root user for better security
USER node

# Start the application with reduced memory usage
CMD ["node", "--optimize_for_size", "--gc_interval=100", "dist/src/main"]