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
    const newUser = this.userRepository.create(createUserDto);
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
    // Get the user with match relations
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: ['matches1', 'matches2'],
    });

    if (!user) {
      throw new HttpException(
        'User with this id does not exist',
        HttpStatus.NOT_FOUND,
      );
    }

    // Debug match counts
    console.log(`User ${userId} - matches1:`, user.matches1?.length || 0);
    console.log(`User ${userId} - matches2:`, user.matches2?.length || 0);

    // Count matches where user is user1 and status is ACCEPTED
    const matchesAsUser1 = await this.matchRepository.count({
      where: {
        user1: { user_id: userId },
        match_status: MatchStatus.ACCEPTED,
      },
    });

    // Count matches where user is user2 and status is ACCEPTED
    const matchesAsUser2 = await this.matchRepository.count({
      where: {
        user2: { user_id: userId },
        match_status: MatchStatus.ACCEPTED,
      },
    });

    const totalMatches = matchesAsUser1 + matchesAsUser2;
    console.log(
      `Total matches counted: ${totalMatches} (${matchesAsUser1} as user1, ${matchesAsUser2} as user2)`,
    );

    // Count likes received (where user is user2 and status is LIKED)
    const likesReceived = await this.matchRepository.count({
      where: {
        user2: { user_id: userId },
        match_status: MatchStatus.LIKED,
      },
    });

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
    };
  }

  /**
   * Get only user photos for separate loading
   */
  async getUserPhotos(userId: number): Promise<UserPhotoDto[]> {
    const user = await this.userRepository.findOne({
      where: {
        user_id: userId,
      },
      relations: {
        photos: true,
      },
      select: {
        user_id: true,
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

    return user.photos;
  }

  /**
   * Get only user interests for separate loading
   */
  async getUserInterests(userId: number): Promise<string[]> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          user_id: userId,
        },
        relations: {
          interests: {
            interest: true,
          },
        },
      });

      if (!user) {
        throw new HttpException(
          'User with this id does not exist',
          HttpStatus.NOT_FOUND,
        );
      }

      // Add null check and return empty array if no interests
      if (!user.interests || !Array.isArray(user.interests)) {
        return [];
      }

      // Safely map interests, filtering out any with missing interest_name
      return user.interests
        .filter((item) => item?.interest?.interest_name)
        .map((item) => item.interest.interest_name);
    } catch (error) {
      console.error('Error fetching user interests:', error);
      // Return empty array instead of throwing to avoid breaking the UI
      return [];
    }
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

    try {
      await this.userRepository.update(userId, updateUserDto);
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
}
