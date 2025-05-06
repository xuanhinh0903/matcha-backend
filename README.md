<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

[travis-image]: https://api.travis-ci.org/nestjs/nest.svg?branch=master
[travis-url]: https://travis-ci.org/nestjs/nest
[linux-image]: https://img.shields.io/travis/nestjs/nest/master.svg?label=linux
[linux-url]: https://travis-ci.org/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore"><img src="https://img.shields.io/npm/dm/@nestjs/core.svg" alt="NPM Downloads" /></a>
<a href="https://travis-ci.org/nestjs/nest"><img src="https://api.travis-ci.org/nestjs/nest.svg?branch=master" alt="Travis" /></a>
<a href="https://travis-ci.org/nestjs/nest"><img src="https://img.shields.io/travis/nestjs/nest/master.svg?label=linux" alt="Linux" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#5" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec"><img src="https://img.shields.io/badge/Donate-PayPal-dc3d53.svg"/></a>
  <a href="https://twitter.com/nestframework"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Matcha Backend

## Introduction

This project is the backend for the Matcha application. It uses Node.js, NestJS, PostgreSQL, and Docker for containerization.

## Configuration

Create a `.env` file in the root directory of the project and add the following environment variables:

```
# .env
NODE_ENV=development
DATABASE_URL=postgres://user:password@matcha-postgres:5432/matcha
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=admin
```

Create a `docker.env` file in the root directory of the project and add the following environment variables:

```
# docker.env
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=matcha
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=admin
```

## Running the Project

### Production

To run the project in production mode, use the following command:

```sh
docker-compose up
```

### Development

To run the project in development mode, use the following command:

```sh
docker compose -f docker-compose.dev.yaml up -d
```

Then run:

```sh
pnpm run start:dev
```

Alternatively, you can use the script defined in `package.json`:

```sh
pnpm run docker:dev
```

This will start the services defined in `docker-compose.dev.yaml`.

## Database Migrations

To create a new migration, use the following command:

```sh
pnpm run migration:create --name=MigrationName
```

To generate a migration based on changes in your entities, use:

```sh
pnpm run migration:generate --name=MigrationName
```

To run all pending migrations, use:

```sh
pnpm run migration:run
```

To revert the last migration, use:

```sh
pnpm run migration:revert
```

## Building the Application

The application is built using a multi-stage Dockerfile. The build process includes installing dependencies, building the application, and copying the necessary files to a smaller image for the final build.

## Services

- **PostgreSQL**: The database service.
- **pgAdmin**: A web-based database management tool (only in development).
- **App**: The main application service.

## Volumes

- `data01`, `data02`, `data03`: Volumes for Elasticsearch data (currently commented out).
- `/var/lib/postgresql/data`: Volume for PostgreSQL data.
- `/var/lib/pgadmin/data`: Volume for pgAdmin data (only in development).

## Networks

- `postgres`: Network for PostgreSQL and pgAdmin.
- `app-network`: Network for the main application.
- `elastic`: Network for Elasticsearch services (currently commented out).

## SQL Table Definitions

```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(15) UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  birthdate DATE NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  location POINT,
  bio TEXT,
  avatar_id INT REFERENCES user_photos(photo_id),
  is_profile_public BOOLEAN DEFAULT TRUE,
  show_age BOOLEAN DEFAULT TRUE,
  show_location BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_photos (
  photo_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  photo_url VARCHAR(255) NOT NULL,
  is_profile_picture BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE matches (
  match_id SERIAL PRIMARY KEY,
  user_1_id INT NOT NULL REFERENCES users(user_id),
  user_2_id INT NOT NULL REFERENCES users(user_id),
  match_status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'accepted', 'rejected', 'liked')),
  liked_at TIMESTAMP,
  matched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  message_id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES conversations(conversation_id),
  sender_id INT NOT NULL REFERENCES users(user_id),
  content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('text', 'emoji', 'sticker', 'image', 'gif')),
  content TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

CREATE TABLE conversations (
  conversation_id SERIAL PRIMARY KEY,
  user_1_id INT NOT NULL REFERENCES users(user_id),
  user_2_id INT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_blocks (
  block_id SERIAL PRIMARY KEY,
  blocker_id INT NOT NULL REFERENCES users(user_id),
  blocked_id INT NOT NULL REFERENCES users(user_id),
  blocked_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unblocked'))
);

CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  notification_type VARCHAR(10) NOT NULL CHECK (notification_type IN ('message', 'match', 'block')),
  notification_content TEXT,
  notification_status VARCHAR(10) NOT NULL DEFAULT 'unread' CHECK (notification_status IN ('unread', 'read')),
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE interests (
  interest_id SERIAL PRIMARY KEY,
  interest_name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE user_interests (
  user_interest_id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(user_id),
  interest_id INT NOT NULL REFERENCES interests(interest_id)
);
```

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

Local:
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin 443370692619.dkr.ecr.ap-southeast-1.amazonaws.com

docker buildx build --platform linux/amd64 -t matcha-app:latest .

docker tag matcha-app:latest 443370692619.dkr.ecr.ap-southeast-1.amazonaws.com/matcha-app:latest
docker push 443370692619.dkr.ecr.ap-southeast-1.amazonaws.com/matcha-app:latest

EC2:
docker pull 443370692619.dkr.ecr.ap-southeast-1.amazonaws.com/matcha-app:latest

docker-compose down
docker-compose up -d

Check logs:
docker-compose logs -f

///

# Remove all stopped containers

docker container prune -f

# Remove all unused images

docker image prune -a -f

# Remove all unused volumes

docker volume prune -f

# Remove all unused networks

docker network prune -f

# Clean up apt cache (optional)

sudo apt-get clean
