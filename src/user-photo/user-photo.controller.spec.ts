import { Test, TestingModule } from '@nestjs/testing';
import { UserPhotoController } from './user-photo.controller';

describe('UserPhotoController', () => {
  let controller: UserPhotoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserPhotoController],
    }).compile();

    controller = module.get<UserPhotoController>(UserPhotoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
