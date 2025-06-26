import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { Conversation } from '../converstation/converstation.entity';
import { MessageGateway } from '../message/message.gateway';
import { NotificationService } from '../notification/notification.service';
import { Match, MatchStatus } from './match.entity';
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
        where: {
          user1: { user_id: userId },
          user2: { user_id: likedUserId },
        },
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
          // Update the reverse match status to ACCEPTED in a single operation
          reverseMatch.match_status = MatchStatus.ACCEPTED;
          reverseMatch.liked_at = new Date();
          await queryRunner.manager.save(reverseMatch);

          // Create a new conversation for the matched users
          const conversation = this.conversationRepository.create({
            user1: { user_id: userId },
            user2: { user_id: likedUserId },
          });
          await queryRunner.manager.save(conversation);

          // Commit transaction early to return quick response
          await queryRunner.commitTransaction();

          // Process match details asynchronously
          this.processMatchDetailsAsync(
            userId,
            likedUserId,
            reverseMatch.match_id,
            conversation.conversation_id,
          );

          // Return quick response to client
          return {
            message: 'User matched successfully',
            status: MatchStatus.ACCEPTED,
            conversation_id: conversation.conversation_id,
            // Indicate that details are still being processed
            is_processing_details: true,
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
      console.error('Error in likeUser:', error);
      throw new HttpException(
        'Error liking user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process match details asynchronously and emit socket events.
   * This allows the main likeUser method to return quickly.
   */
  private async processMatchDetailsAsync(
    userId: number,
    likedUserId: number,
    matchId: number,
    conversationId: number,
  ) {
    try {
      console.log(
        `Processing match details asynchronously for match ${matchId}`,
      );
      const startTime = Date.now();

      // Get both users with optimized queries (only fetch necessary fields)
      const [currentUser, matchedUser] = await Promise.all([
        this.userRepository.findOne({
          where: { user_id: userId },
          select: ['user_id', 'full_name', 'email'],
          relations: ['photos'],
        }),
        this.userRepository.findOne({
          where: { user_id: likedUserId },
          select: ['user_id', 'full_name', 'email'],
          relations: ['photos'],
        }),
      ]);

      // Validate users exist
      if (!currentUser || !matchedUser) {
        console.error('User not found during async match processing');
        return;
      }

      // Get display names and profile pictures
      const currentUserName = currentUser.full_name || `User ${userId}`;
      const matchedUserName = matchedUser.full_name || `User ${likedUserId}`;

      const currentUserPhoto =
        currentUser.photos?.find((p) => p.is_profile_picture)?.photo_url ||
        currentUser.photos?.[0]?.photo_url ||
        null;

      const matchedUserPhoto =
        matchedUser.photos?.find((p) => p.is_profile_picture)?.photo_url ||
        matchedUser.photos?.[0]?.photo_url ||
        null;

      // Prepare match data for both users
      const currentUserMatchData = {
        matchId,
        conversationId,
        otherUser: {
          user_id: likedUserId,
          full_name: matchedUserName,
          profile_picture: matchedUserPhoto,
        },
      };

      const matchedUserMatchData = {
        matchId,
        conversationId,
        otherUser: {
          user_id: userId,
          full_name: currentUserName,
          profile_picture: currentUserPhoto,
        },
      };

      // Emit WebSocket events with complete data
      this.messageGateway.server
        .to(`user-${userId}`)
        .emit('match_details', currentUserMatchData);

      this.messageGateway.server
        .to(`user-${likedUserId}`)
        .emit('match_details', matchedUserMatchData);

      // Create notification
      await this.notificationService.createNotification(
        matchedUser,
        'match',
        `You have a new match with ${currentUserName}!`,
      );

      const executionTime = Date.now() - startTime;
      console.log(`Async match processing completed in ${executionTime}ms`);
    } catch (error) {
      console.error('Error in processMatchDetailsAsync:', error);
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
   * Get users for matching based on various criteria - Optimized for performance.
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
    // Performance tracking
    const startTime = Date.now();
    console.log(
      `Starting getUsersForMatching for userId: ${userId}, page: ${page}, limit: ${limit}`,
    );

    try {
      // Build query with targeted selects and efficient joins
      const query = this.userRepository
        .createQueryBuilder('user')
        .select([
          'user.user_id',
          'user.full_name',
          'user.birthdate',
          'user.gender',
          'user.location', // Add location to the selected fields
        ])
        // Only join profile photos for better performance
        .leftJoin('user.photos', 'photos', 'photos.is_profile_picture = true')
        .addSelect([
          'photos.photo_id',
          'photos.photo_url',
          'photos.photo_url_thumbnail',
        ])
        // Basic filter - exclude current user
        .where('user.user_id != :userId', { userId });

      // Use a properly-formatted subquery with JOIN instead of EXISTS to avoid case-sensitivity issues
      query.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('1')
          .from('match', 'm')
          .where(
            '(m."user1UserId" = :userId AND m."user2UserId" = user.user_id) OR ' +
              '(m."user2UserId" = :userId AND m."user1UserId" = user.user_id AND m.match_status != :onlyLiked)',
          )
          .setParameter('userId', userId)
          .setParameter('onlyLiked', MatchStatus.LIKED)
          .getQuery();

        return `NOT EXISTS ${subQuery}`;
      });

      // Handle gender filter with optimal SQL conditions
      if (gender) {
        const genders = gender.split(',');
        if (genders.length === 1) {
          query.andWhere('user.gender = :gender', { gender: genders[0] });
        } else if (genders.length > 1) {
          query.andWhere('user.gender IN (:...genders)', { genders });
        }
      }

      // Handle age range filter with optimized date comparison
      if (ageRange) {
        const minBirthDate = new Date();
        minBirthDate.setFullYear(minBirthDate.getFullYear() - ageRange.max);

        const maxBirthDate = new Date();
        maxBirthDate.setFullYear(maxBirthDate.getFullYear() - ageRange.min);

        query.andWhere('user.birthdate BETWEEN :minAge AND :maxAge', {
          minAge: minBirthDate,
          maxAge: maxBirthDate,
        });
      }

      // Handle interest filtering with a more efficient approach
      if (interests) {
        const interestIds = interests
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id));

        if (interestIds.length > 0) {
          // Use a more QueryBuilder approach instead of raw SQL to avoid case sensitivity issues
          query.andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('1')
              .from('user_interest', 'ui')
              .where('ui."userUserId" = user.user_id')
              .andWhere('ui."interestInterestId" IN (:...interestIds)', {
                interestIds,
              })
              .limit(1)
              .getQuery();

            return `EXISTS ${subQuery}`;
          });
        }
      }

      //       // Filter users who have location data (distance calculation will be done in post-processing)
      if (
        location?.lat &&
        location?.lon &&
        !isNaN(location.lat) &&
        !isNaN(location.lon) &&
        range &&
        !isNaN(range)
      ) {
        // Only require location to be not null, distance filtering will be done with geolib
        query.andWhere('user.location IS NOT NULL');
      }

      // Set up randomized but stable ordering for consistent pagination
      const randomSeed = Math.floor(
        Math.floor(Date.now() / (3600 * 1000)) % 10000,
      );
      query
        .orderBy(`(user.user_id * ${randomSeed} + user.user_id) % 997`, 'ASC')
        .addOrderBy('user.user_id', 'ASC'); // Secondary sort for stability

      // Get the total count for pagination metadata
      const totalCount = await query.getCount();
      console.log(`Found ${totalCount} potential matches for user ${userId}`);

      // Apply pagination
      query.offset((page - 1) * limit).limit(limit);

      // Execute the optimized query
      const users = await query.getMany();

      // Post-process users efficiently - calculate age and distance, then filter by range
      const currentYear = new Date().getFullYear();
      let processedUsers = users.map((user) => {
        const age = currentYear - new Date(user.birthdate).getFullYear();

        // Calculate distance if both locations available
        let distance = null;
        if (location?.lat && location?.lon && user.location) {
          try {
            // Handle location as GeoJSON Point
            const userCoords = (user.location as any)?.coordinates;

            if (userCoords && userCoords.length === 2) {
              // userCoords is [longitude, latitude] in GeoJSON format
              distance = geolib.getDistance(
                { latitude: userCoords[1], longitude: userCoords[0] },
                { latitude: location.lat, longitude: location.lon },
              ) / 1000; // Convert to kilometers
            }
          } catch (e) {
            console.error('Error calculating distance:', e);
          }
        }

        // Clean up the response structure
        const result = {
          ...user,
          age,
          distance, // Add distance to result (in kilometers)
        };

        delete result.password; // Remove sensitive data
        return result;
      });

      // Filter users by distance range if location and range are provided
      if (location?.lat && location?.lon && range && !isNaN(range)) {
        processedUsers = processedUsers.filter((user) => {
          return user.distance !== null && user.distance <= range;
        });

        // Sort by distance (nearest first) when location filtering is applied
        processedUsers.sort((a, b) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      }

      console.log('🚀 ~ MatchService ~ processedUsers ~ count after filtering:', processedUsers.length);

      // Log performance metrics
      const executionTime = Date.now() - startTime;
      console.log(
        `getUsersForMatching completed in ${executionTime}ms, found ${users.length} matches`,
      );

      // Apply pagination to filtered results if location filtering was applied
      let paginatedUsers = processedUsers;
      let finalTotal = totalCount;

      if (location?.lat && location?.lon && range && !isNaN(range)) {
        // When location filtering is applied, we need to paginate the filtered results
        finalTotal = processedUsers.length;
        const startIndex = (page - 1) * limit;
        paginatedUsers = processedUsers.slice(startIndex, startIndex + limit);
      }

      return {
        users: paginatedUsers,
        total: finalTotal,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error in getUsersForMatching:', error);
      throw error;
    }
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
