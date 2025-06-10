import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Interest } from 'src/interest/entities/interest.entity';
import { UserInterest } from './entities/user-interest.entity';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class UserInterestService {
  constructor(
    @InjectRepository(Interest)
    private interestRepository: Repository<Interest>,

    @InjectRepository(UserInterest)
    private userInterestRepository: Repository<UserInterest>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async setUserInterests(userId: number, interestIds: number[]) {
    // Kiểm tra user có tồn tại không
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['interests', 'interests.interest'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Lọc các interest hợp lệ từ danh sách interestIds
    const interests = await this.interestRepository.find({
      where: { interest_id: In(interestIds) },
    });
    if (interests.length === 0) {
      throw new NotFoundException('No valid interests found');
    }

    // Xóa sở thích cũ của user trước khi cập nhật
    await this.userInterestRepository.delete({ user: { user_id: userId } });

    // Tạo mới danh sách user-interest
    const newUserInterests = interests.map((interest) => {
      const userInterest = new UserInterest();
      userInterest.user = user;
      userInterest.interest = interest;
      return userInterest;
    });

    // Lưu danh sách user-interest mới
    await this.userInterestRepository.save(newUserInterests);

    // Kiểm tra lại dữ liệu đã lưu
    const updatedUser = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['interests', 'interests.interest'],
    });

    console.log('Updated user interests:', updatedUser?.interests);

    return {
      message: 'User interests updated successfully',
      interests: updatedUser?.interests?.map((ui) => ui.interest) || [],
    };
  }

  async getUserInterests(userId: number) {
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      relations: ['interests', 'interests.interest'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return both the raw interest IDs and the full interest objects for maximum flexibility
    return {
      interestIds: user.interests?.map((ui) => ui.interest.interest_id) || [],
      interests: user.interests?.map((ui) => ui.interest) || [],
    };
  }
}
