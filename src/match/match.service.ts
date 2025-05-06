import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchStatus } from './match.entity';
import { User } from 'src/user/entities/user.entity';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { Conversation } from '../converstation/converstation.entity';
import { MessageGateway } from '../message/message.gateway';
import { NotificationService } from '../notification/notification.service';
import { Point } from 'geojson';
import * as geolib from 'geolib';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserInterest)
    private userInterestRepository: Repository<UserInterest>,
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    private messageGateway: MessageGateway,
    private notificationService: NotificationService,
  ) {}

  async unmatchUser(userId: number, unmatchUserId: number) {
    const queryRunner =
      this.matchRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Find the match between the two users
      const match = await queryRunner.manager.findOne(Match, {
        where: [
          { user1: { user_id: userId }, user2: { user_id: unmatchUserId } },
          { user1: { user_id: unmatchUserId }, user2: { user_id: userId } },
        ],
      });

      if (!match) {
        throw new HttpException('Match not found', HttpStatus.NOT_FOUND);
      }

      // Delete the match
      await queryRunner.manager.remove(match);

      await queryRunner.commitTransaction();
      return {
        message: 'Unmatched successfully',
        status: MatchStatus.UNMATCHED,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new HttpException(
        'Error unmatching user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Calculate distance between two points using geolib
   * @param point1 First point coordinates [longitude, latitude] or null
   * @param point2 Second point coordinates [longitude, latitude] or null
   * @returns Distance in kilometers or null if either point is missing
   */
  private getDistance(
    point1: [number, number] | null | undefined,
    point2: [number, number] | null | undefined,
  ): number | null {
    if (!point1 || !point2) {
      return null;
    }

    try {
      // geolib expects coordinates in the format { latitude, longitude }
      const distance = geolib.getDistance(
        { latitude: point1[1], longitude: point1[0] },
        { latitude: point2[1], longitude: point2[0] },
      );

      // Convert from meters to kilometers
      return distance / 1000;
    } catch (error) {
      console.error('Error calculating distance:', error);
      return null;
    }
  }

  /**
   * Apply strong randomization to an array of user IDs
   * Uses Fisher-Yates shuffle algorithm for unbiased randomization
   * @param users Array of user objects with user_id property
   * @returns Randomized array of user objects
   */
  private applyStrongRandomization(
    users: { user_id: number }[],
  ): { user_id: number }[] {
    // Create a copy of the array to avoid mutating the original
    const shuffled = [...users];

    // Apply Fisher-Yates (Knuth) shuffle algorithm
    // This is an unbiased shuffling algorithm that gives true randomization
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Generate a random index between 0 and i (inclusive)
      const j = Math.floor(Math.random() * (i + 1));

      // Swap elements at i and j
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Add additional entropy by using a timestamp-based seed
    const seed = new Date().getTime();

    // Apply a secondary randomization based on the seed
    // This ensures different results even with the same dataset
    shuffled.sort(() => {
      // Generate a random number using the timestamp seed
      // Math.sin() produces a value between -1 and 1, creating different orderings each time
      return Math.sin(seed + Math.random()) > 0 ? 1 : -1;
    });

    return shuffled;
  }

  /**
   * Like a user and handle mutual matching.
   * @param userId - ID of the user who likes.
   * @param likedUserId - ID of the user being liked.
   * @returns Response message and match status.
   */
  async likeUser(userId: number, likedUserId: number) {
    const queryRunner =
      this.matchRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if the current user has already liked the liked user
      let match = await queryRunner.manager.findOne(Match, {
        where: { user1: { user_id: userId }, user2: { user_id: likedUserId } },
      });

      if (match) {
        // Update the match status to LIKED
        match.match_status = MatchStatus.LIKED;
        match.liked_at = new Date();
        await queryRunner.manager.save(match);

        await queryRunner.commitTransaction();
        return {
          message: 'User liked successfully',
          status: MatchStatus.LIKED,
        };
      } else {
        // Check if the liked user has already liked the current user
        const reverseMatch = await queryRunner.manager.findOne(Match, {
          where: {
            user1: { user_id: likedUserId },
            user2: { user_id: userId },
          },
        });

        if (reverseMatch) {
          // Update the reverse match status to ACCEPTED
          reverseMatch.match_status = MatchStatus.ACCEPTED;
          reverseMatch.liked_at = new Date();
          await queryRunner.manager.save(reverseMatch);

          // Create a new conversation for the matched users
          const conversation = this.conversationRepository.create({
            user1: { user_id: userId },
            user2: { user_id: likedUserId },
          });
          await queryRunner.manager.save(conversation);

          // Get both users for notifications with complete data for notification service
          const [currentUser, matchedUser] = await Promise.all([
            this.userRepository.findOne({
              where: { user_id: userId },
              select: ['user_id', 'full_name', 'email'], // Adding required fields for notification
              relations: ['photos'], // Include photos for notification display
            }),
            this.userRepository.findOne({
              where: { user_id: likedUserId },
              select: ['user_id', 'full_name', 'email'],
              relations: ['photos'],
            }),
          ]);

          // Validate users exist
          if (!currentUser || !matchedUser) {
            throw new HttpException(
              'One or both users not found',
              HttpStatus.NOT_FOUND,
            );
          }

          // Get display names for the users
          const currentUserName = currentUser?.full_name || `User ${userId}`;
          const matchedUserName =
            matchedUser?.full_name || `User ${likedUserId}`;

          // Emit match event through WebSocket
          this.messageGateway.server.to(`user-${userId}`).emit('new_match', {
            matchId: reverseMatch.match_id,
            conversationId: conversation.conversation_id,
            otherUser: {
              user_id: likedUserId,
              full_name: matchedUserName,
            },
          });

          this.messageGateway.server
            .to(`user-${likedUserId}`)
            .emit('new_match', {
              matchId: reverseMatch.match_id,
              conversationId: conversation.conversation_id,
              otherUser: {
                user_id: userId,
                full_name: currentUserName,
              },
            });

          // Create notifications for both users with safe names
          await Promise.all([
            this.notificationService.createNotification(
              currentUser,
              'match',
              `You have a new match with ${matchedUserName}!`,
            ),
            this.notificationService.createNotification(
              matchedUser,
              'match',
              `You have a new match with ${currentUserName}!`,
            ),
          ]);

          await queryRunner.commitTransaction();
          return {
            message: 'User matched successfully',
            status: MatchStatus.ACCEPTED,
            conversation_id: conversation.conversation_id,
          };
        } else {
          // Create a new match with status LIKED
          match = this.matchRepository.create({
            user1: { user_id: userId },
            user2: { user_id: likedUserId },
            match_status: MatchStatus.LIKED,
            liked_at: new Date(),
          });
          await queryRunner.manager.save(match);

          await queryRunner.commitTransaction();
          return {
            message: 'User liked successfully',
            status: MatchStatus.LIKED,
          };
        }
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new HttpException(
        'Error liking user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Unlike a user.
   * @param userId - ID of the user who is unliking.
   * @param unlikedUserId - ID of the user being unliked.
   * @returns Response message and status.
   */
  async unlikeUser(userId: number, unlikedUserId: number) {
    try {
      // Find the existing like record
      const match = await this.matchRepository.findOne({
        where: {
          user1: { user_id: userId },
          user2: { user_id: unlikedUserId },
          match_status: MatchStatus.LIKED,
        },
      });

      if (!match) {
        throw new HttpException('No like record found', HttpStatus.NOT_FOUND);
      }

      // Delete the match record
      await this.matchRepository.remove(match);

      return {
        message: 'User unliked successfully',
        status: 'UNLIKED',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error unliking user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Dislike a user.
   * @param userId - ID of the user who dislikes.
   * @param dislikedUserId - ID of the user being disliked.
   * @returns Response message and match status.
   */
  async dislikeUser(userId: number, dislikedUserId: number) {
    try {
      const match = this.matchRepository.create({
        user1: { user_id: userId },
        user2: { user_id: dislikedUserId },
        match_status: MatchStatus.REJECTED,
      });
      await this.matchRepository.save(match);

      return {
        message: 'User disliked successfully',
        status: MatchStatus.REJECTED,
      };
    } catch (error) {
      throw new HttpException(
        'Error disliking user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get matches for a user.
   * @param userId - ID of the user to get matches for.
   * @returns List of matches.
   */
  async getMatches(userId: number) {
    return this.matchRepository.find({
      where: [
        { user1: { user_id: userId }, match_status: MatchStatus.ACCEPTED },
        { user2: { user_id: userId }, match_status: MatchStatus.ACCEPTED },
      ],
      relations: ['user1', 'user2'],
    });
  }

  /**
   * Get users for matching based on various criteria.
   * @param userId - ID of the current user.
   * @param page - Page number for pagination.
   * @param limit - Number of users per page.
   * @param location - Current location of the user.
   * @param gender - Gender of the partner.
   * @param range - Range in kilometers to find matches.
   * @param ageRange - Age range of the partner.
   * @returns List of users for matching.
   */
  async getUsersForMatching(
    userId: number,
    page: number,
    limit: number,
    location?: { lat: number; lon: number },
    gender?: string,
    range?: number,
    ageRange?: { min: number; max: number },
    interests?: string,
  ) {
    const skip = (page - 1) * limit;
    console.log('skip', skip);
    console.log('limit', limit);
    console.log('location', location);
    console.log('gender filter', gender);
    console.log('range', range);
    console.log('ageRange', ageRange);
    console.log('interests', interests);

    // If filter interests are provided, get user IDs that have at least one matching interest
    let userIdsWithMatchingInterests: number[] = [];
    if (interests) {
      const filterInterestIds = interests
        .split(',')
        .map((id) => parseInt(id, 10));
      if (
        filterInterestIds.length > 0 &&
        !filterInterestIds.some((id) => isNaN(id))
      ) {
        try {
          const usersWithInterests = await this.userInterestRepository
            .createQueryBuilder('userInterest')
            .select('userInterest.user_id', 'userId')
            .distinct(true)
            .where('userInterest.interest_id IN (:...filterInterestIds)', {
              filterInterestIds,
            })
            .getRawMany();

          userIdsWithMatchingInterests = usersWithInterests.map(
            (ui) => ui.userId,
          );
          console.log(
            'Users with matching interests count:',
            userIdsWithMatchingInterests.length,
          );
          console.log(
            'Sample user IDs with matching interests:',
            userIdsWithMatchingInterests.slice(0, 5),
          );
        } catch (error) {
          console.error('Error fetching users with matching interests:', error);
        }
      } else {
        console.error('Invalid interest IDs:', interests);
      }
    }

    // Get user interests
    const userInterests = await this.userInterestRepository.find({
      where: { user: { user_id: userId } },
      relations: ['interest'],
    });
    const interestIds = userInterests.map((ui) => ui.interest.interest_id);
    console.log('User interests count:', interestIds.length);

    // Get users the current user has liked or matched with - these should be excluded
    const excludedUsers = await this.matchRepository.find({
      where: [
        { user1: { user_id: userId }, match_status: MatchStatus.LIKED },
        { user1: { user_id: userId }, match_status: MatchStatus.ACCEPTED },
        { user2: { user_id: userId }, match_status: MatchStatus.ACCEPTED },
        { user2: { user_id: userId }, match_status: MatchStatus.LIKED }, // Add this case to exclude users that you've liked where you are user2
      ],
      relations: ['user1', 'user2'],
    });
    const excludedUserIds = excludedUsers
      .map((match) => {
        // Get the ID of the OTHER user (not the current user)
        if (match.user1.user_id === userId) {
          return match.user2.user_id; // Current user is user1, exclude user2
        } else {
          return match.user1.user_id; // Current user is user2, exclude user1
        }
      })
      .filter((id) => id !== null); // Filter out any null values
    console.log('Excluded users count:', excludedUserIds.length);

    // Get users who have mutually rejected the current user - these should also be excluded
    const mutualRejections = await this.matchRepository
      .createQueryBuilder('match')
      .innerJoin(
        Match,
        'reverse_match',
        'match.user1 = reverse_match.user2 AND match.user2 = reverse_match.user1',
      )
      .where('match.user1 = :userId', { userId })
      .andWhere('match.match_status = :rejected', {
        rejected: MatchStatus.REJECTED,
      })
      .andWhere('reverse_match.match_status = :rejected', {
        rejected: MatchStatus.REJECTED,
      })
      .getMany();

    const mutualRejectionIds = mutualRejections
      .map((match) => match.user2?.user_id || null)
      .filter((id) => id !== null);
    console.log('Mutual rejection users count:', mutualRejectionIds.length);

    // Combine all excluded user ids
    const allExcludedUserIds = [
      ...new Set([userId, ...excludedUserIds, ...mutualRejectionIds]),
    ];
    console.log('Total excluded users count:', allExcludedUserIds.length);

    // Get eligible user IDs with enhanced randomization
    const userIdsQuery = this.userRepository
      .createQueryBuilder('user')
      .select('user.user_id')
      .where('user.user_id != :userId', { userId });

    // Apply interest filter if interest IDs are provided
    if (userIdsWithMatchingInterests.length > 0) {
      userIdsQuery.andWhere(
        'user.user_id IN (:...userIdsWithMatchingInterests)',
        {
          userIdsWithMatchingInterests,
        },
      );
      console.log(
        'Filtering by interests, matching users count:',
        userIdsWithMatchingInterests.length,
      );
    }

    if (allExcludedUserIds.length > 0) {
      userIdsQuery.andWhere('user.user_id NOT IN (:...allExcludedUserIds)', {
        allExcludedUserIds,
      });
    }

    // Handle gender filter - now supports comma-separated values
    if (gender) {
      const genders = gender.split(',');
      if (genders.length === 1) {
        userIdsQuery.andWhere('user.gender = :gender', { gender: genders[0] });
      } else if (genders.length > 1) {
        userIdsQuery.andWhere('user.gender IN (:...genders)', { genders });
      }
      console.log('Filtering by genders:', genders);
    }

    if (ageRange) {
      const minBirthDate = new Date();
      minBirthDate.setFullYear(minBirthDate.getFullYear() - ageRange.max);

      const maxBirthDate = new Date();
      maxBirthDate.setFullYear(maxBirthDate.getFullYear() - ageRange.min);

      userIdsQuery.andWhere('user.birthdate BETWEEN :minAge AND :maxAge', {
        minAge: minBirthDate,
        maxAge: maxBirthDate,
      });
      console.log('Filtering by age range:', ageRange);
    }

    if (location && range) {
      const point = `ST_SetSRID(ST_Point(:lon, :lat), 4326)`;
      userIdsQuery.andWhere(
        `"user"."location" IS NOT NULL AND ST_DistanceSphere("user"."location", ${point})::float / 1000 <= :range`,
        { lon: location.lon, lat: location.lat, range },
      );
      console.log('Filtering by range:', range);
    }

    // Get total count of eligible users for statistics
    const totalCount = await userIdsQuery.getCount();
    console.log('Total eligible users before randomization:', totalCount);

    // Enhanced randomization strategy:
    // 1. First, get all eligible user IDs without pagination
    // 2. Then apply multiple randomization techniques

    let eligibleUserIds: { user_id: number }[] = [];

    // If there's a reasonable number of users, fetch all and randomize in memory
    if (totalCount < 1000) {
      // Safe threshold for in-memory processing
      // Get all eligible user IDs
      eligibleUserIds = await userIdsQuery.getMany();

      // Apply strong in-memory randomization
      eligibleUserIds = this.applyStrongRandomization(eligibleUserIds);

      // Apply pagination after randomization
      const startIndex = skip;
      const endIndex = Math.min(startIndex + limit, eligibleUserIds.length);
      eligibleUserIds = eligibleUserIds.slice(startIndex, endIndex);
    }
    // For larger datasets, use database randomization with additional techniques
    else {
      // For larger datasets, use database randomization with a random offset
      // Generate a random offset within the valid range
      const maxOffset = Math.max(0, totalCount - limit);
      const randomOffset = Math.floor(Math.random() * maxOffset);

      console.log(
        `Using random offset ${randomOffset} out of max ${maxOffset}`,
      );

      // Use a random timestamp seed for ordering to ensure different results each time
      const timestampSeed = new Date().getTime();

      // Combine random functions for stronger randomization
      eligibleUserIds = await userIdsQuery
        .orderBy(`MD5(CAST(user.user_id AS text) || '${timestampSeed}')`)
        .offset(randomOffset)
        .limit(limit)
        .getMany();
    }

    const ids = eligibleUserIds.map((user) => user.user_id);
    console.log('Randomly selected user IDs:', ids);

    if (ids.length === 0) {
      return {
        users: [],
        total: 0,
        page,
        limit,
      };
    }

    // Now fetch full user data for these IDs
    const query = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.user_id',
        'user.email',
        'user.phone_number',
        'user.full_name',
        'user.birthdate',
        'user.gender',
        'user.location',
        'user.bio',
        'user.last_active',
        'user.is_online',
        'user.is_verified',
        'user.created_at',
        'user.updated_at',
      ])
      .leftJoinAndSelect('user.photos', 'photos')
      .where('user.user_id IN (:...ids)', { ids });

    // IMPORTANT: We'll no longer use SQL for distance calculation
    // We'll do all distance calculations using geolib after fetching the users

    const users = await query.getMany();
    const total = await userIdsQuery.getCount();

    // Process users with geolib distance calculation only
    const processedUsers = [];

    for (const user of users) {
      delete user.password;

      // Calculate age
      const age = new Date().getFullYear() - user.birthdate.getFullYear();

      // If we have both the current location from frontend and the user location from DB
      if (location && user.location?.coordinates) {
        const userCoordinates = user.location.coordinates;
      }

      processedUsers.push({
        ...user,
        age,
      });
    }

    return {
      users: processedUsers,
      total: processedUsers.length,
      page,
      limit,
    };
  }

  /**
   * Get users who have liked the current user.
   * @param userId - ID of the current user.
   * @param page - Page number for pagination.
   * @param limit - Number of users per page.
   * @returns List of users who have liked the current user.
   */
  async getLikesReceived(userId: number, page: number = 1, limit: number = 10) {
    console.log('getLikesReceived called', { userId, page, limit });
    const skip = (page - 1) * limit;

    // Find users who have liked the current user but current user hasn't liked back yet
    const matches = await this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.user1', 'liker')
      .leftJoinAndSelect('liker.photos', 'photos')
      .where('match.user2 = :userId', { userId })
      .andWhere('match.match_status = :status', { status: MatchStatus.LIKED })
      .orderBy('match.liked_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    // Process users to include age and other required information
    const processedUsers = matches.map((match) => {
      const user = match.user1;
      delete user.password;

      // Calculate age
      const age = new Date().getFullYear() - user.birthdate.getFullYear();

      return {
        ...user,
        age,
        liked_at: match.liked_at,
      };
    });

    const total = await this.matchRepository
      .createQueryBuilder('match')
      .where('match.user2 = :userId', { userId })
      .andWhere('match.match_status = :status', { status: MatchStatus.LIKED })
      .getCount();

    return {
      users: processedUsers,
      total,
      page,
      limit,
    };
  }

  /**
   * Get users that the current user has liked.
   * @param userId - ID of the current user.
   * @param page - Page number for pagination.
   * @param limit - Number of users per page.
   * @returns List of users that the current user has liked.
   */
  async getLikesSent(userId: number, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    // Find users that the current user has liked but haven't liked back yet
    const matches = await this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.user2', 'liked')
      .leftJoinAndSelect('liked.photos', 'photos')
      .where('match.user1 = :userId', { userId })
      .andWhere('match.match_status = :status', { status: MatchStatus.LIKED })
      .orderBy('match.liked_at', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    // Process users to include age and other required information
    const processedUsers = matches.map((match) => {
      const user = match.user2;
      delete user.password;

      // Calculate age
      const age = new Date().getFullYear() - user.birthdate.getFullYear();

      return {
        ...user,
        age,
        liked_at: match.liked_at,
      };
    });

    const total = await this.matchRepository
      .createQueryBuilder('match')
      .where('match.user1 = :userId', { userId })
      .andWhere('match.match_status = :status', { status: MatchStatus.LIKED })
      .getCount();

    return {
      users: processedUsers,
      total,
      page,
      limit,
    };
  }
}
