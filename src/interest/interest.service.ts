import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import CreateInterestDto from './dto/createInterest.dto';
import { Interest } from './entities/interest.entity';

@Injectable()
export class InterestService {
  constructor(
    @InjectRepository(Interest)
    private interestRepository: Repository<Interest>,
  ) {}

  async getAllInterests() {
    const interests = await this.interestRepository.find();
    return interests.map((interest) => ({
      interest_id: interest.interest_id,
      interest_name: interest.interest_name,
    }));
  }
  async createInterest(createInterestDto: CreateInterestDto) {
    const { interest_name } = createInterestDto;

    // Kiểm tra xem sở thích đã tồn tại chưa
    let interest = await this.interestRepository.findOne({
      where: { interest_name },
    });
    // Nếu chưa có, tạo mới
    if (!interest) {
      interest = this.interestRepository.create({ interest_name });
      await this.interestRepository.save(interest);
      return { message: 'Interest added successfully', interest };
    }
    return { message: 'Interest existed ', interest };
  }

  async updateInterest(
    interestId: number,
    updateInterestDto: CreateInterestDto,
  ) {
    const { interest_name } = updateInterestDto;

    // Kiểm tra xem sở thích có tồn tại không
    const interest = await this.interestRepository.findOne({
      where: { interest_id: interestId },
    });
    if (!interest) {
      throw new NotFoundException('Interest not found');
    }

    // Kiểm tra xem tên mới có bị trùng không
    const existingInterest = await this.interestRepository.findOne({
      where: { interest_name },
    });
    if (existingInterest && existingInterest.interest_id !== interestId) {
      throw new ConflictException('Interest name already exists');
    }

    // Cập nhật tên sở thích
    interest.interest_name = interest_name;
    await this.interestRepository.save(interest);

    return { message: 'Interest updated successfully', interest };
  }

  async deleteUserInterest(interestId: number) {
    await this.interestRepository.delete(interestId);
    return { message: 'Interest removed' };
  }
}
