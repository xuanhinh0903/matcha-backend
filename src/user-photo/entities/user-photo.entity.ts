import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity()
export class UserPhoto {
  @PrimaryGeneratedColumn()
  photo_id: number;

  @ManyToOne(() => User, (user) => user.photos)
  user: User;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  public_id: string; // ✅ Thêm public_id để quản lý trên Cloudinary

  @Column({ nullable: true })
  photo_url_thumbnail: string;

  @Index()
  @Column({ nullable: true })
  is_profile_picture: boolean;

  @CreateDateColumn()
  uploaded_at: Date;

  @OneToMany(() => User, (user) => user.photos)
  profile_picture: User;
}
