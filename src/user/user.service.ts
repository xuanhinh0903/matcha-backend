import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Match, MatchStatus } from 'src/match/match.entity';
import { UserPhotoDto } from 'src/user-photo/dto/user-photo.dto';
import { UserPhoto } from 'src/user-photo/entities/user-photo.entity';
import { Not, Repository } from 'typeorm';
import { BasicUserProfileDto } from './dto/basic-user-profile.dto';
import CreateUserDto from './dto/createUser.dto';
import { UpdateUserDto } from './dto/updateUser.dto';
import { UserInfoDto } from './dto/user-info.dto';
import { UserMatchStatsDto } from './dto/user-match-stats';
import { UserProfileDto } from './dto/user-profile.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(UserPhoto)
    private readonly userPhotoRepository: Repository<UserPhoto>,
  ) {}

  async getByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });
    if (user) return user;
    throw new HttpException(
      'User with this email does not exist',
      HttpStatus.NOT_FOUND,
    );
  }

  async getByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: {
        firebase_uid: firebaseUid,
      },
    });
    return user;
  }

  async getById(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        user_id: id,
      },
      select: {
        photos: {
          photo_id: true,
          is_profile_picture: true,
        },
      },
    });
    if (user) return user;
    throw new HttpException(
      'User with this id does not exist',
      HttpStatus.NOT_FOUND,
    );
  }

  async createUser(createUserDto: CreateUserDto) {
    // Tự động thêm vị trí mặc định nếu user chưa có location
    // Default location: Hanoi, Vietnam (105.772382, 21.0779701)
    const defaultLocation = {
      type: 'Point' as const,
      coordinates: [105.772382, 21.0779701],
    };

    const newUser = this.userRepository.create({
      ...createUserDto,
      // Chỉ thêm location mặc định nếu user chưa có location
      location: createUserDto.location || defaultLocation,
    });
    
    await this.userRepository.save(newUser);
    return newUser;
  }

  async getProfilePhoto(userId: number): Promise<string | null> {
    const profilePhoto = await this.userPhotoRepository.findOne({
      where: {
        is_profile_picture: true,
        user: {
          user_id: userId,
        },
      },
    });
    return profilePhoto?.photo_url || '';
  }

  async getUserInfo(userId: number): Promise<UserInfoDto> {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },

      select: {
        user_id: true,
        email: true,
        phone_number: true,
        is_verified: true,
        full_name: true,
        birthdate: true,
        gender: true,
        location: {
          type: true,
          coordinates: true,
        },
        bio: true,
        last_active: true,
        is_online: true,
      },
    });

    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    const profilePhoto = await this.getProfilePhoto(user.user_id);
    const { ...userInfo } = user;

    return {
      ...userInfo,
      profile_thumbnail: profilePhoto,
    };
  }

  async getMatchStats(userId: number): Promise<UserMatchStatsDto> {
    // First verify that user exists with a lightweight query
    const userExists = await this.userRepository.existsBy({ user_id: userId });

    if (!userExists) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    // Use query builder with proper column references for relationships
    const matchCounts = await this.matchRepository
      .createQueryBuilder('match')
      .select([
        `COUNT(CASE WHEN 
            (match.user1 = :userId OR match.user2 = :userId) 
            AND match.match_status = :acceptedStatus 
            THEN 1 END) as "totalMatches"`,
        `COUNT(CASE WHEN 
            match.user2 = :userId 
            AND match.match_status = :likedStatus 
            THEN 1 END) as "likesReceived"`,
      ])
      .setParameters({
        userId,
        acceptedStatus: MatchStatus.ACCEPTED,
        likedStatus: MatchStatus.LIKED,
      })
      .getRawOne();

    // Extract values from the result
    const totalMatches = parseInt(matchCounts?.totalMatches) || 0;
    const likesReceived = parseInt(matchCounts?.likesReceived) || 0;

    // Calculate match rate
    const totalInteractions = totalMatches + likesReceived;
    const matchRate =
      totalInteractions > 0 ? (totalMatches / totalInteractions) * 100 : 0;

    return {
      user_id: userId,
      matchStats: {
        totalMatches,
        likesReceived,
        matchRate: Math.round(matchRate * 10) / 10, // Round to 1 decimal place
      },
    };
  }

  async getUserProfile(userId: number): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: {
        photos: true,
      },
      select: {
        user_id: true,
        full_name: true,
        birthdate: true,
        gender: true,
        location: {
          type: true,
          coordinates: true,
        },
        bio: true,
        last_active: true,
        is_online: true,
        is_verified: true,
        interests: {
          interest: {
            interest_id: true,
            interest_name: true,
          },
        },
        photos: {
          photo_id: true,
          photo_url: true,
          photo_url_thumbnail: true,
          is_profile_picture: true,
          uploaded_at: true,
        },
      },
    });

    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  /**
   * Get basic user profile without photos and interests for faster initial loading
   */
  async getBasicUserProfile(userId: number): Promise<BasicUserProfileDto> {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      select: {
        user_id: true,
        full_name: true,
        birthdate: true,
        gender: true,
        location: {
          type: true,
          coordinates: true,
        },
        bio: true,
        last_active: true,
        is_online: true,
        is_verified: true,
      },
    });

    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    // Calculate age from birthdate
    const birthDate = new Date(user.birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Ensure we have the correct format for coordinates
    const coordinates: [number, number] =
      user.location?.coordinates.length >= 2
        ? [user.location.coordinates[0], user.location.coordinates[1]]
        : [0, 0]; // Default coordinates if not available

    return {
      user_id: user.user_id,
      verified: user.is_verified,
      full_name: user.full_name,
      age: age,
      bio: user.bio || '',
      location: {
        coordinates,
      },
      last_active: user.last_active,
      is_online: user.is_online,
      distance: 0, // This should be calculated based on user's location
      gender: user.gender,
    };
  }

  /**
   * Get only user photos for separate loading
   */
  async getUserPhotos(userId: number): Promise<UserPhotoDto[]> {
    console.log('getUserPhotos User ID:', userId);

    // Use a more direct and efficient query with createQueryBuilder
    const photos = await this.userPhotoRepository
      .createQueryBuilder('photo')
      .select([
        'photo.photo_id',
        'photo.photo_url',
        'photo.photo_url_thumbnail',
        'photo.is_profile_picture',
        'photo.public_id',
        'photo.uploaded_at',
      ])
      .where('photo.userUserId = :userId', { userId })
      .getMany();

    console.log('User photos:', photos);
    return photos;
  }

  /**
   * Get user's profile photo efficiently
   */
  async getUserProfilePhoto(userId: number): Promise<UserPhotoDto | null> {
    return this.userPhotoRepository
      .createQueryBuilder('photo')
      .select([
        'photo.photo_id',
        'photo.photo_url',
        'photo.photo_url_thumbnail',
        'photo.public_id',
        'photo.uploaded_at',
      ])
      .where('photo.userUserId = :userId', { userId })
      .andWhere('photo.is_profile_picture = :isProfilePic', {
        isProfilePic: true,
      })
      .getOne();
  }

  /**
   * Get only user interests for separate loading
   */
  // async getUserInterests(userId: number): Promise<string[]> {
  //   try {
  //     const user = await this.userRepository.findOne({
  //       where: {
  //         user_id: userId,
  //       },
  //       relations: {
  //         interests: {
  //           interest: true,
  //         },
  //       },
  //     });

  //     if (!user) {
  //       throw new HttpException(
  //         'User with this id does not exist',
  //         HttpStatus.NOT_FOUND,
  //       );
  //     }

  //     // Add null check and return empty array if no interests
  //     if (!user.interests || !Array.isArray(user.interests)) {
  //       return [];
  //     }

  //     // Safely map interests, filtering out any with missing interest_name
  //     return user.interests
  //       .filter((item) => item?.interest?.interest_name)
  //       .map((item) => item.interest.interest_name);
  //   } catch (error) {
  //     console.error('Error fetching user interests:', error);
  //     // Return empty array instead of throwing to avoid breaking the UI
  //     return [];
  //   }
  // }
  async getUserInterests(userId: number): Promise<string[]> {
    const startTime = Date.now();

    const raw = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.interests', 'userInterest')
      .leftJoin('userInterest.interest', 'interest')
      .select('interest.interest_name', 'name')
      .where('user.user_id = :userId', { userId })
      .andWhere('interest.interest_name IS NOT NULL')
      .getRawMany<{ name: string }>();

    const names = raw?.length ? raw.map((r) => r.name) : [];

    const duration = Date.now() - startTime;
    console.log(`getUserInterests(userId=${userId}) executed in ${duration}ms`);

    return names;
  }

  async updateUser(userId: number, updateUserDto: UpdateUserDto) {
    // Check if email already exists for another user
    if (updateUserDto.email) {
      const userWithEmail = await this.userRepository.findOne({
        where: {
          email: updateUserDto.email,
          user_id: Not(userId),
        },
      });
      if (userWithEmail) {
        throw new HttpException(
          'Email is already in use by another user',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Check if phone number already exists for another user
    if (updateUserDto.phone_number) {
      const userWithPhone = await this.userRepository.findOne({
        where: {
          phone_number: updateUserDto.phone_number,
          user_id: Not(userId),
        },
      });
      if (userWithPhone) {
        throw new HttpException(
          'Phone number is already in use by another user',
          HttpStatus.CONFLICT,
        );
      }
    }

    // Luôn thêm location mặc định khi update user
    // Default location: Hanoi, Vietnam (105.772382, 21.0779701)  
    const defaultLocation = {
      type: 'Point' as const,
      coordinates: [105.772382, 21.0779701],
    };

    const updatedData = {
      ...updateUserDto,
      // Luôn set location mặc định bất kể người dùng có truyền location hay không
      location: defaultLocation,
    };

    try {
      await this.userRepository.update(userId, updatedData);
    } catch (error) {
      if (
        error.message.includes('duplicate key value violates unique constraint')
      ) {
        throw new HttpException(
          'A user with this email or phone number already exists',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }

    const updatedUser = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
    });
    if (updatedUser) return updatedUser;
    throw new HttpException(
      'User with this id does not exist',
      HttpStatus.NOT_FOUND,
    );
  }

  async deleteUser(userId: number) {
    const deleteResult = await this.userRepository.delete(userId);
    if (!deleteResult.affected) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Update user's online status and last active time
   */
  async updateOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
    });

    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    // Update online status and last active time
    await this.userRepository.update(userId, {
      is_online: isOnline,
      last_active: new Date(),
    });
  }
}
