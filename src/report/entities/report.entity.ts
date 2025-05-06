import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ReportImage } from './report-image.entity';

@Entity()
export class Report {
  @PrimaryGeneratedColumn()
  report_id: number;

  @ManyToOne(() => User)
  reporter: User;

  @ManyToOne(() => User)
  reported: User;

  @Column({
    type: 'enum',
    enum: ['fake_profile', 'inappropriate_content', 'harassment', 'other'],
  })
  report_reason: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'reviewed', 'closed'],
    default: 'pending',
  })
  status: string;

  @OneToMany(() => ReportImage, (image) => image.report, { cascade: true })
  images: ReportImage[];

  @CreateDateColumn()
  created_at: Date;
}
