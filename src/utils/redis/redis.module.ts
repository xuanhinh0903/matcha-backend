import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@liaoliaots/nestjs-redis';
import { REDIS_CLIENT } from './redis.constants';
import type Redis from 'ioredis';

@Global()
@Module({
  imports: [
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL'); // Nếu Redis chạy bằng URI
        const redisConfig = redisUrl
          ? { url: redisUrl } // Nếu có URL, ưu tiên dùng URL
          : {
              host: configService.get<string>('REDIS_HOST', 'localhost'),
              port: configService.get<number>('REDIS_PORT', 6379),
              password: configService.get<string>('REDIS_PASSWORD', undefined),
              db: configService.get<number>('REDIS_DB', 0), // Hỗ trợ chọn DB Redis
              keyPrefix: 'matcha:', // Prefix để tránh trùng ke
            };

        return {
          config: redisConfig,
          readyLog: true,
          // Add event listeners for connection events
          onClientCreated: (client: Redis) => {
            // Log when Redis connects successfully
            client.on('connect', () => {
              console.log('[Redis] Connecting...');
            });
            // Log when Redis is ready to use
            client.on('ready', () => {
              console.log('[Redis] Connection established and ready!');
            });
            // Log when Redis disconnects
            client.on('end', () => {
              console.warn('[Redis] Disconnected from server.');
            });
            // Log when Redis is reconnecting
            client.on('reconnecting', () => {
              console.log('[Redis] Attempting to reconnect...');
            });
            // Log when Redis encounters an error
            client.on('error', (err: Error) => {
              console.error('[Redis] Connection error:', err);
            });
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
