import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { UserService } from 'src/user/user.service';
import CreateUserDto from 'src/user/dto/createUser.dto';
import LoginDto from './dto/login.dto';
import { PostgresErrorCode } from 'src/database/postgresErrorCodes.enum';
import { User } from 'src/user/entities/user.entity';
import { TokenPayload } from './interfaces/tokenPayload.interface';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  public async register(registerData: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(registerData.password, 10);
    try {
      const createdUser = await this.userService.createUser({
        ...registerData,
        password: hashedPassword,
      });
      delete createdUser.password;
      console.log('SUCCESSFUL REGISTRATION:', createdUser);
      return createdUser;
    } catch (err) {
      console.log('ERROR DURING REGISTRATION:', err);
      if (err?.code === PostgresErrorCode.UniqueViolation) {
        throw new HttpException(
          'User with that email already exists',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async login(loginData: LoginDto) {
    const user = await this.userService.getByEmail(loginData.email);
    await this.verifyPassword(loginData.password, user.password);

    const accessTokenCookie = this.getCookieWithJwtAccessToken(user);
    return {
      user,
      accessTokenCookie: accessTokenCookie.cookie,
      accessToken: accessTokenCookie.token,
    };
  }

  private async verifyPassword(
    plainTextPassword: string,
    hashedPassword: string,
  ) {
    const isPasswordMatching = await bcrypt.compare(
      plainTextPassword,
      hashedPassword,
    );
    if (!isPasswordMatching) {
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  public getCookieWithJwtAccessToken(user: User) {
    const payload: TokenPayload = { userId: user.user_id, ...user };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: `${this.configService.get('JWT_ACCESS_TOKEN_EXPIRATION_TIME')}s`,
    });
    const cookie = `Authentication=${token}; HttpOnly; Path=/; Max-Age=${this.configService.get('JWT_ACCESS_TOKEN_EXPIRATION_TIME')}`;
    return { token, cookie };
  }

  public logout(res: Response) {
    res.setHeader('Set-Cookie', [
      'Authentication=; HttpOnly; Path=/; Max-Age=0',
      'Refresh=; HttpOnly; Path=/; Max-Age=0',
    ]);
  }
}
