import { Test, TestingModule } from '@nestjs/testing';
import { UserInterestService } from './user-interest.service';

describe('UserInterestService', () => {
  let service: UserInterestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserInterestService],
    }).compile();

    service = module.get<UserInterestService>(UserInterestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
