import { User } from 'src/user/entities/user.entity';

export interface TokenPayload extends Omit<User, 'password'> {
  userId: number;
}
