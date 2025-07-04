import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBlock } from './entities/user-block.entity';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class UserBlockService {
  constructor(
    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Block 1 user
  async blockUser(userId: number, blockedUserId: number) {
    if (userId === blockedUserId) {
      throw new ConflictException('Bạn không thể tự block chính mình.');
    }

    const blocker = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    const blocked = await this.userRepository.findOne({
      where: { user_id: blockedUserId },
    });

    if (!blocker || !blocked) {
      throw new NotFoundException('Người dùng không tồn tại.');
    }

    // Kiểm tra xem đã block trước đó chưa
    const existingBlock = await this.userBlockRepository.findOne({
      where: { blocker, blocked },
    });

    if (existingBlock) {
      throw new ConflictException('Bạn đã chặn người này rồi.');
    }

    const userBlock = this.userBlockRepository.create({
      blocker,
      blocked,
    });

    return this.userBlockRepository.save(userBlock);
  }

  // Unblock 1 user
  async unblockUser(userId: number, blockedUserId: number) {
    const unblock = await this.userBlockRepository.findOne({
      where: {
        blocker: { user_id: userId },
        blocked: { user_id: blockedUserId },
      },
    });

    if (!unblock) {
      throw new NotFoundException('Người dùng này chưa bị chặn.');
    }

    return this.userBlockRepository.remove(unblock);
  }

  //Lấy danh sách user đã block
  async getBlockedUsers(userId: number) {
    const blockedUsers = await this.userBlockRepository.find({
      where: { blocker: { user_id: userId } },
      relations: ['blocked', 'blocked.photos'], // Load user bị block và photos của họ
      select: {
        blocked: {
          user_id: true,
          email: true,
          full_name: true,
          birthdate: true,
          gender: true,
          bio: true,
          photos: {
            photo_id: true,
            photo_url: true,
            photo_url_thumbnail: true,
            is_profile_picture: true,
            uploaded_at: true,
          },
        },
      },
    });

    return blockedUsers.map((block) => {
      // Calculate age from birthdate if available
      const age = block.blocked.birthdate 
        ? new Date().getFullYear() - new Date(block.blocked.birthdate).getFullYear()
        : null;

      return {
        user_id: block.blocked.user_id,
        email: block.blocked.email,
        full_name: block.blocked.full_name,
        age,
        gender: block.blocked.gender,
        bio: block.blocked.bio,
        photos: block.blocked.photos || [],
        blocked_at: block.blocked_at,
      };
    });
  }

  // Check if either user has blocked the other
  async isBlockedBetween(userAId: number, userBId: number): Promise<boolean> {
    const block = await this.userBlockRepository.findOne({
      where: [
        { blocker: { user_id: userAId }, blocked: { user_id: userBId } },
        { blocker: { user_id: userBId }, blocked: { user_id: userAId } },
      ],
    });
    return !!block;
  }
}
