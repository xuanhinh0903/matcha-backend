import { Report } from './report.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class ReportImage {
  @PrimaryGeneratedColumn()
  image_id: number;

  @Column()
  original_url: string;

  @Column()
  thumbnail_url: string;

  @Column()
  public_id: string;

  @ManyToOne(() => Report, (report) => report.images, { onDelete: 'CASCADE' })
  report: Report;

  @CreateDateColumn()
  created_at: Date;
}
