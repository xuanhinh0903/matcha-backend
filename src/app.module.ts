import { RedisModule } from '@liaoliaots/nestjs-redis';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { AuthenticationModule } from './authentication/authentication.module';
import { DatabaseModule } from './database/database.module';
import { ElasticSearchModule } from './elasticsearch/elasticsearch.module';
import { HealthModule } from './health/health.module';
import { InterestModule } from './interest/interest.module';
import { MatchModule } from './match/match.module';
import { SearchModule } from './search/search.module';
import { UserInterestModule } from './user-interest/user-interest.module';
import { UserPhotoModule } from './user-photo/user-photo.module';
import { UserModule } from './user/user.module';
import { CloudinaryModule } from './utils/cloudinary/cloudinary.module';
import { UserBlockModule } from './user-block/user-block.module';
import { MessageModule } from './message/message.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { CallModule } from './call/call.module';
import { ConversationModule } from './converstation/converstation.module';
import { UserSettingsModule } from './user-settings/user-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test'),
        // Conditionally validate based on environment
        // ...(process.env.NODE_ENV !== 'production'
        //   ? {
        //       POSTGRES_HOST: Joi.string().required(),
        //       POSTGRES_PORT: Joi.number().required(),
        //       POSTGRES_USER: Joi.string().required(),
        //       POSTGRES_PASSWORD: Joi.string().required(),
        //       POSTGRES_DB: Joi.string().required(),
        //     }
        //   : {
        //   DATABASE_URL: Joi.string().required(),
        // }),
        PORT: Joi.number(),
        JWT_ACCESS_TOKEN_SECRET: Joi.string().required(),
        JWT_ACCESS_TOKEN_EXPIRATION_TIME: Joi.string().required(),
        JWT_REFRESH_TOKEN_SECRET: Joi.string().required(),
        JWT_REFRESH_TOKEN_EXPIRATION_TIME: Joi.string().required(),
        AWS_REGION: Joi.string().required(),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_PUBLIC_BUCKET_NAME: Joi.string().required(),
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
        // Redis and elasticsearch configuration
        ELASTICSEARCH_NODE: Joi.string().required(),
        ELASTICSEARCH_USERNAME: Joi.string().required(),
        ELASTICSEARCH_PASSWORD: Joi.string().required(),
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        REDIS_PASSWORD: Joi.string().allow('').optional(),
        EXPO_ACCESS_TOKEN: Joi.string().required(),
      }),
    }),
    DatabaseModule,
    UserModule,
    AuthenticationModule,
    SearchModule,
    InterestModule,
    UserInterestModule,
    UserPhotoModule,
    CloudinaryModule,
    MatchModule,
    RedisModule,
    ElasticSearchModule,
    UserBlockModule,
    MessageModule,
    NotificationModule,
    HealthModule,
    ReportModule,
    CallModule,
    ConversationModule,
    UserSettingsModule,
  ],
})
export class AppModule {}
