import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import CreateUserDto from 'src/user/dto/createUser.dto';
import { AuthenticationService } from './authentication.service';
import LoginDto from './dto/login.dto';
import { JwtGuard } from './guards/jwt.guard';
import RequestWithUser from './interfaces/requestWithUser.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('register')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'test@example.com' },
        password: { type: 'string', example: 'strongPassword@123' },
      },
      required: ['email', 'password'],
    },
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'test@example.com' },
        password: { type: 'string', example: 'strongPassword@123' },
      },
      required: ['email', 'password'],
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    console.log('Login attempt:', loginDto);
    const { user, accessTokenCookie, accessToken } =
      await this.authService.login(loginDto);
    console.log('Login successful:', user);
    res.setHeader('Set-Cookie', [accessTokenCookie]);
    return { email: user.email, token: accessToken };
  }

  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @Post('logout')
  async logout(@Req() request: RequestWithUser, @Res() res: Response) {
    this.authService.logout(res);
    return res.sendStatus(200);
  }

  // @UseGuards(JwtRefreshTokenGuard)
  // @Get('refresh')
  // async refresh(
  //   @Req() req: RequestWithUser,
  //   @Res({ passthrough: true }) res: Response,
  // ) {
  //   const { cookie } = this.authService.getCookieWithJwtAccessToken(
  //     req.user.user_id,
  //   );
  //   res.setHeader('Set-Cookie', cookie);
  //   return req.user;
  // }
}
