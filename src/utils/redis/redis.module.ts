import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@liaoliaots/nestjs-redis';
import { REDIS_CLIENT } from './redis.constants';

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
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
