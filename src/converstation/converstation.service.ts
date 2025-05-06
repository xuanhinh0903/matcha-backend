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
      // Single optimized query using JOIN to get the conversation details
      const conversation = await this.conversationRepository
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.user1', 'user1')
        .leftJoinAndSelect('conversation.user2', 'user2')
        .leftJoinAndSelect(
          'user1.photos',
          'user1_photos',
          'user1_photos.is_profile_picture = :isProfilePicture',
        )
        .leftJoinAndSelect(
          'user2.photos',
          'user2_photos',
          'user2_photos.is_profile_picture = :isProfilePicture',
        )
        .where('conversation.conversation_id = :conversationId', {
          conversationId,
          isProfilePicture: true,
        })
        .getOne();

      if (!conversation) {
        throw new NotFoundException(
          `Conversation with ID ${conversationId} not found`,
        );
      }

      // Check if user is part of the conversation
      if (
        conversation.user1.user_id !== user.user_id &&
        conversation.user2.user_id !== user.user_id
      ) {
        throw new UnauthorizedException(
          'You are not authorized to view this conversation',
        );
      }

      // Determine which user is the "other" user in this conversation
      const otherUser =
        conversation.user1.user_id === user.user_id
          ? conversation.user2
          : conversation.user1;

      // Format response with detailed data
      return {
        conversation_id: conversation.conversation_id,
        created_at: conversation.created_at,
        other_user: {
          user_id: otherUser.user_id,
          full_name: otherUser.full_name,
          photo_url: otherUser.photos[0]?.photo_url_thumbnail || null,
          is_online: otherUser.is_online || false,
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
