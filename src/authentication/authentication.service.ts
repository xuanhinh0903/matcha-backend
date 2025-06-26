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
import { FirebaseService } from './firebase/firebase.service';
import { FirebaseLoginDto } from './dto/firebase-login.dto';

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly firebaseService: FirebaseService,
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

    // Check if the user is banned
    if (user.is_banned) {
      const now = new Date();

      // Check if the ban has expired
      if (user.ban_expires_at && user.ban_expires_at < now) {
        // Ban has expired, update user status
        await this.userService.updateUser(user.user_id, {
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          ban_expires_at: null,
        });
      } else {
        // User is still banned
        const banExpiryMessage = user.ban_expires_at
          ? `Ban expires at ${user.ban_expires_at.toISOString()}.`
          : 'This ban has no expiration date.';

        throw new HttpException(
          `Account is banned. Reason: ${user.ban_reason || 'No reason provided'}. ${banExpiryMessage}`,
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const accessTokenCookie = this.getCookieWithJwtAccessToken(user);
    return {
      user,
      accessTokenCookie: accessTokenCookie.cookie,
      accessToken: accessTokenCookie.token,
    };
  }

  /**
   * Handle Firebase Google Sign-In authentication
   * Creates new user if doesn't exist, or returns existing user
   */
  public async firebaseLogin(firebaseLoginData: FirebaseLoginDto) {
    try {
      // Verify Firebase ID token
      const decodedToken = await this.firebaseService.verifyIdToken(firebaseLoginData.idToken);
      
      // Extract user information from Firebase token
      const { uid, email, name, picture } = decodedToken;
      
      if (!email) {
        throw new HttpException(
          'Email is required for Firebase authentication',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if user already exists by Firebase UID
      let user = await this.userService.getByFirebaseUid(uid);
      
      if (!user) {
        // Check if user exists by email (existing email/password user)
        try {
          const existingUser = await this.userService.getByEmail(email);
          if (existingUser) {
            // Link Firebase UID to existing user
            user = await this.userService.updateUser(existingUser.user_id, {
              firebase_uid: uid,
            });
          }
        } catch (error) {
          // User doesn't exist by email, create new user
          user = await this.userService.createUser({
            email,
            firebase_uid: uid,
            full_name: name || null,
            is_verified: true, // Firebase users are considered verified
            // No password required for Firebase users
          });
        }
      }

      // Check if user is banned
      if (user.is_banned) {
        const now = new Date();
        if (user.ban_expires_at && user.ban_expires_at < now) {
          // Ban has expired, update user status
          await this.userService.updateUser(user.user_id, {
            is_banned: false,
            ban_reason: null,
            banned_at: null,
            ban_expires_at: null,
          });
        } else {
          // User is still banned
          const banExpiryMessage = user.ban_expires_at
            ? `Ban expires at ${user.ban_expires_at.toISOString()}.`
            : 'This ban has no expiration date.';

          throw new HttpException(
            `Account is banned. Reason: ${user.ban_reason || 'No reason provided'}. ${banExpiryMessage}`,
            HttpStatus.FORBIDDEN,
          );
        }
      }

      // Generate JWT token for the user
      const accessTokenCookie = this.getCookieWithJwtAccessToken(user);
      
      // Remove sensitive data
      delete user.password;
      
      return {
        user,
        accessTokenCookie: accessTokenCookie.cookie,
        accessToken: accessTokenCookie.token,
      };
      
    } catch (error) {
      console.log('ERROR DURING FIREBASE LOGIN:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Firebase authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
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
