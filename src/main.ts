import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { config as AwsConfig } from 'aws-sdk';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ExceptionLoggerFilter } from './utils/exceptions/exceptionLogger.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

// Custom adapter to properly handle Socket.IO connections
class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        credentials: true,
        allowedHeaders: [
          'content-type',
          'authorization',
          'accept',
          'cache-control',
          'x-requested-with',
          'pragma',
          'expires',
        ],
      },
      allowEIO3: true, // Allow Engine.IO v3 clients
      path: '/socket.io/', // Default Socket.IO path
      connectTimeout: 60000, // Increased from 45000
      pingTimeout: 40000, // Increased from 30000
      pingInterval: 25000, // Match frontend interval
      transports: ['websocket', 'polling'],
    });

    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Use for parse cookie
  app.use(cookieParser());

  //  User custom exception filter
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new ExceptionLoggerFilter(httpAdapter));

  // use to validate upcomming data
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // // Testing purpose
  // app.useGlobalInterceptors(
  //   new ClassSerializerInterceptor(app.get(Reflector)),
  //   new ExcludeNullInterceptor(),
  // );

  const configService = app.get(ConfigService);
  AwsConfig.update({
    accessKeyId: configService.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY'),
    region: configService.get('AWS_REGION'),
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Matcha APIs Documentation')
    .setDescription('This is a documentation for Matcha APIs')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'content-type',
      'authorization',
      'accept',
      'cache-control',
      'x-requested-with',
      'pragma',
      'expires',
    ],
  });

  // Use the custom adapter
  app.useWebSocketAdapter(new CustomIoAdapter(app));

  // Listen on all network interfaces (0.0.0.0) instead of just localhost
  await app.listen(process.env.PORT ?? 3030, '0.0.0.0');
}
bootstrap();
