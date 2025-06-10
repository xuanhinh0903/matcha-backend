import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { PrivacySettingsDto } from './dto/privacy-settings.dto';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly userSettingsRepository: Repository<UserSettings>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getOrCreateUserSettings(userId: number): Promise<UserSettings> {
    // Check if user exists
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Check if user settings exists
    let userSettings = await this.userSettingsRepository.findOne({
      where: { user: { user_id: userId } },
    });

    // If not, create new settings
    if (!userSettings) {
      userSettings = this.userSettingsRepository.create({
        user,
        // Default values are set in the entity
      });
      await this.userSettingsRepository.save(userSettings);
    }

    return userSettings;
  }

  async updatePrivacySettings(
    userId: number,
    privacySettings: PrivacySettingsDto,
  ): Promise<void> {
    try {
      // Get or create user settings
      const userSettings = await this.getOrCreateUserSettings(userId);

      // We're storing privacy settings as JSON in a database column
      // For a real implementation, we should create a separate entity for privacy settings
      // This is a simplified approach for a prototype

      // Update privacy settings
      await this.userSettingsRepository.update(
        { settings_id: userSettings.settings_id },
        {
          // Store the privacy settings as custom properties
          privacy_photos: privacySettings.photos,
          privacy_bio: privacySettings.bio,
          privacy_age: privacySettings.age,
          privacy_interests: privacySettings.interests,
          // privacy_match_stats: privacySettings.matchStats,
        },
      );
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw new HttpException(
        'Failed to update privacy settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPrivacySettings(userId: number): Promise<PrivacySettingsDto> {
    try {
      // Get or create user settings
      const userSettings = await this.getOrCreateUserSettings(userId);

      // Return privacy settings
      return {
        photos: userSettings.privacy_photos || 'public',
        bio: userSettings.privacy_bio || 'public',
        age: userSettings.privacy_age || 'matches',
        interests: userSettings.privacy_interests || 'public',
        // matchStats: userSettings.privacy_match_stats || 'private',
      };
    } catch (error) {
      console.error('Error getting privacy settings:', error);
      throw new HttpException(
        'Failed to get privacy settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
