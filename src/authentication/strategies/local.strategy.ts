import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthenticationService } from '../authentication.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authenticationService: AuthenticationService) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<User> {
    try {
      const user = await this.authenticationService.login({
        email,
        password,
      });
      return user.user;
    } catch (error) {
      throw new HttpException(
        error.response || 'Invalid credentials',
        error.status || HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
