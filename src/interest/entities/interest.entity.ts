import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity()
export class Interest {
  @PrimaryGeneratedColumn()
  interest_id: number;

  @Column({ unique: true })
  interest_name: string;

  @OneToMany(() => UserInterest, (userInterest) => userInterest.interest)
  userInterests: UserInterest[];
}
