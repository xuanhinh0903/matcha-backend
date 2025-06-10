import { Interest } from 'src/interest/entities/interest.entity';
import { User } from 'src/user/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

@Entity()
export class UserInterest {
  @PrimaryGeneratedColumn()
  user_interest_id: number;

  @ManyToOne(() => User, (user) => user.interests)
  user: User;

  @ManyToOne(() => Interest, (interest) => interest.userInterests)
  interest: Interest;
}
