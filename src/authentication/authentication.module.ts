import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { UserModule } from 'src/user/user.module';
import { LocalStrategy } from './strategies/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshTokenStrategy } from './strategies/jwt-refresh-token.strategy';
import { RolesGuard } from './guards/roles.guard';
import { FirebaseService } from './firebase/firebase.service';

@Module({
  imports: [
    UserModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          secret: configService.getOrThrow('JWT_ACCESS_TOKEN_SECRET'),
          signOptions: {
            expiresIn: configService.getOrThrow(
              'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
            ),
          },
        };
      },
    }),
  ],
  providers: [
    AuthenticationService,
    FirebaseService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshTokenStrategy,
    RolesGuard,
  ],
  controllers: [AuthenticationController],
  exports: [RolesGuard],
})
export class AuthenticationModule {}
