import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Conversation } from './converstation.entity';
import { UserService } from 'src/user/user.service';
import { ConversationProfileDto } from './dto/conversation-profile.dto';
import { UserSettingsService } from 'src/user-settings/user-settings.service';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userService: UserService,
    private userSettingsService: UserSettingsService,
  ) {}

  async getConversationById(conversationId: number, user: User): Promise<any> {
    console.log(
      'Fetching conversation details for ID:',
      conversationId,
      'User ID:',
      user.user_id,
    );

    try {
      // Use direct query to get only the necessary data in one go
      const result = await this.conversationRepository
        .createQueryBuilder('conversation')
        .select('conversation.conversation_id', 'conversation_id')
        .addSelect('conversation.created_at', 'created_at')
        .addSelect('u1.user_id', 'user1_id')
        .addSelect('u2.user_id', 'user2_id')
        .addSelect('u1.full_name', 'user1_name')
        .addSelect('u2.full_name', 'user2_name')
        .addSelect('u1.is_online', 'user1_online')
        .addSelect('u2.is_online', 'user2_online')
        .innerJoin('conversation.user1', 'u1')
        .innerJoin('conversation.user2', 'u2')
        .where('conversation.conversation_id = :conversationId', {
          conversationId,
        })
        .getRawOne();

      if (!result) {
        throw new NotFoundException(
          `Conversation with ID ${conversationId} not found`,
        );
      }

      // Check if user is part of the conversation
      if (
        result.user1_id !== user.user_id &&
        result.user2_id !== user.user_id
      ) {
        throw new UnauthorizedException(
          'You are not authorized to view this conversation',
        );
      }

      // Determine which user is the "other" user in this conversation
      const isUser1 = result.user1_id === user.user_id;
      const otherUserId = isUser1 ? result.user2_id : result.user1_id;
      const otherUserName = isUser1 ? result.user2_name : result.user1_name;
      const otherUserOnline = isUser1
        ? result.user2_online
        : result.user1_online;

      // Get profile photo in a separate optimized query
      const profilePhoto = await this.userRepository
        .createQueryBuilder('user')
        .select('photo.photo_url_thumbnail', 'photo_url')
        .innerJoin(
          'user.photos',
          'photo',
          'photo.is_profile_picture = :isProfilePic',
          { isProfilePic: true },
        )
        .where('user.user_id = :userId', { userId: otherUserId })
        .getRawOne();

      // Format response with detailed data
      return {
        conversation_id: result.conversation_id,
        created_at: result.created_at,
        other_user: {
          user_id: otherUserId,
          full_name: otherUserName,
          photo_url: profilePhoto?.photo_url || null,
          is_online: otherUserOnline || false,
        },
        current_user: {
          user_id: user.user_id,
        },
      };
    } catch (error) {
      console.error('Error fetching conversation details:', error);
      throw error;
    }
  }

  /**
   * Get the profile of a user in a conversation, respecting privacy settings
   */
  async getConversationProfile(
    conversationId: number,
    currentUserId: number,
    otherUserId: number,
  ): Promise<ConversationProfileDto> {
    // Verify the conversation exists and the current user is part of it
    const conversation = await this.conversationRepository.findOne({
      where: [
        {
          conversation_id: conversationId,
          user1: { user_id: currentUserId },
          user2: { user_id: otherUserId },
        },
        {
          conversation_id: conversationId,
          user1: { user_id: otherUserId },
          user2: { user_id: currentUserId },
        },
      ],
      relations: ['user1', 'user2'],
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found or you are not a participant',
      );
    }

    // Get the basic profile information
    const basicProfile =
      await this.userService.getBasicUserProfile(otherUserId);

    // Get the user's privacy settings
    const privacySettings =
      await this.userSettingsService.getPrivacySettings(otherUserId);

    // Determine what to show based on privacy settings
    // Since these users are matched (in a conversation), they can see "matches" level data
    const showPhotos = ['public', 'matches'].includes(privacySettings.photos);
    const showBio = ['public', 'matches'].includes(privacySettings.bio);
    const showAge = ['public', 'matches'].includes(privacySettings.age);
    const showInterests = ['public', 'matches'].includes(
      privacySettings.interests,
    );

    // Prepare the response with privacy filters
    const profile: ConversationProfileDto = {
      user_id: basicProfile.user_id,
      full_name: basicProfile.full_name,
      age: showAge ? basicProfile.age : null,
      is_online: basicProfile.is_online,
      last_active: basicProfile.last_active,
      distance: basicProfile.distance,

      // Only include these if privacy settings allow
      bio: showBio ? basicProfile.bio : null,
      photos: showPhotos
        ? await this.userService.getUserPhotos(otherUserId)
        : [],
      interests: showInterests
        ? await this.userService.getUserInterests(otherUserId)
        : [],

      // Include privacy visibility flags for frontend UI decisions
      show_photos: showPhotos,
      show_bio: showBio,
      show_age: showAge,
      show_interests: showInterests,
    };

    return profile;
  }
}
