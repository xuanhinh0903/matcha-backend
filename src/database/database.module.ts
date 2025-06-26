import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const isProduction = true;

        // For production, use the complete DATABASE_URL
        if (isProduction) {
          const databaseUrl = configService.get('DATABASE_URL');

          if (!databaseUrl) {
            logger.error(
              'DATABASE_URL is not defined in production environment',
            );
            throw new Error('DATABASE_URL is not defined');
          }

          logger.log(
            `Connecting to database using URL (domain only shown): ${databaseUrl.split('@')[1]?.split('/')[0] || 'unable to parse URL'}`,
          );

          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/../**/*.entity.{js,ts}'],
            synchronize: false,
            autoLoadEntities: true,
            migrations: [__dirname + '/../**/*.entity.{js,ts}'],
            ssl: {
              rejectUnauthorized: false,
            },
            connectTimeoutMS: 20000, // Increase connection timeout to 20 seconds
            maxQueryExecutionTime: 1000, // Log slow queries
            logging: ['error', 'warn'],
            retryAttempts: 10, // Increase retry attempts
            retryDelay: 5000, // Increase delay between retries to 5 seconds
            cli: {
              migrationsDir: 'src/database/migrations',
            },
            keepConnectionAlive: true, // Keep connection alive during app reload,
          };
        } else {
          // For non-production environments
          return {
            type: 'postgres',
            host: configService.get('POSTGRES_HOST'),
            port: configService.get('POSTGRES_PORT'),
            username: configService.get('POSTGRES_USER'),
            password: configService.get('POSTGRES_PASSWORD'),
            database: configService.get('POSTGRES_DB'),
            entities: [__dirname + '/../**/*.entity.{js,ts}'],
            synchronize: false,
            autoLoadEntities: true,
            migrations: [__dirname + '/../**/*.entity.{js,ts}'],
            logging: ['error', 'warn', 'query'],
            cli: {
              migrationsDir: 'src/database/migrations',
            },
          };
        }
      },
    }),
  ],
})
export class DatabaseModule {}
