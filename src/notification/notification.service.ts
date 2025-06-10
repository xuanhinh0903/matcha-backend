import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { SystemNotificationDto } from './dto/system-notification.dto';
import { DeviceToken } from './entities/device-token.entity';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationService {
  private expo: Expo;

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    this.expo = new Expo();
  }

  async createNotification(
    user: User,
    type: string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user,
      notification_type: type,
      notification_content: content,
    });

    await this.notificationRepository.save(notification);
    await this.sendPushNotification(user, content, type, metadata);

    return notification;
  }

  async sendSystemNotification(
    notificationData: SystemNotificationDto,
  ): Promise<void> {
    const users = await this.userRepository.find();
    for (const user of users) {
      await this.createNotification(
        user,
        notificationData.type,
        notificationData.content,
      );
    }
  }

  async getNotifications(userId: number, page: number = 1, limit: number = 10) {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { user: { user_id: userId } },
        order: { sent_at: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
        relations: ['user', 'user.photos'],
      });

    const formattedNotifications = notifications.map((notification) => {
      const baseNotification = {
        notification_id: notification.notification_id,
        notification_type: notification.notification_type,
        notification_content: notification.notification_content,
        notification_status: notification.notification_status,
        sent_at: notification.sent_at,
      };

      // For system notifications, return just the base notification
      if (notification.notification_type === 'system') {
        return {
          ...baseNotification,
          is_system: true,
        };
      }

      // For user notifications, include user information
      return {
        ...baseNotification,
        is_system: false,
        from_user: {
          user_id: notification.user.user_id,
          full_name: notification.user.full_name,
          profile_picture: notification.user.photos?.find(
            (photo) => photo.is_profile_picture,
          )?.photo_url,
        },
      };
    });

    return {
      notifications: formattedNotifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(
    userId: number,
    notificationId: number,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { notification_id: notificationId, user: { user_id: userId } },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.notification_status = 'read';
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update(
      { user: { user_id: userId }, notification_status: 'unread' },
      { notification_status: 'read' },
    );
  }

  async deleteNotification(
    userId: number,
    notificationId: number,
  ): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { notification_id: notificationId, user: { user_id: userId } },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.notificationRepository.remove(notification);
  }

  async registerDevice(
    userId: number,
    token: string,
    platform: string,
  ): Promise<DeviceToken> {
    console.log('Registering device:', { userId, token, platform });

    try {
      // Special handling for fake tokens used for error recovery
      if (token.startsWith('ExpoFakeToken')) {
        console.log('Detected fake token for error recovery:', token);
        // Save it as inactive to avoid trying to send notifications to it
        const deviceToken = this.deviceTokenRepository.create({
          user: { user_id: userId } as User,
          token,
          platform,
          isActive: false,
        });
        return this.deviceTokenRepository.save(deviceToken);
      }

      // Standard validation for real tokens
      if (!Expo.isExpoPushToken(token)) {
        console.warn(`Invalid Expo push token format: ${token}`);
        // Save it as inactive but don't throw error to prevent app crashes
        const deviceToken = this.deviceTokenRepository.create({
          user: { user_id: userId } as User,
          token,
          platform,
          isActive: false,
        });
        return this.deviceTokenRepository.save(deviceToken);
      }

      const existingToken = await this.deviceTokenRepository.findOne({
        where: { token },
      });

      if (existingToken) {
        console.log('Updating existing token:', token);
        existingToken.lastUsed = new Date();
        existingToken.isActive = true; // Reactivate if it was deactivated
        existingToken.user = { user_id: userId } as User; // Fix the TypeScript error by using type assertion for the User relation
        return this.deviceTokenRepository.save(existingToken);
      }

      console.log('Creating new device token record:', token);
      const deviceToken = this.deviceTokenRepository.create({
        user: { user_id: userId } as User,
        token,
        platform,
        isActive: true,
      });

      return this.deviceTokenRepository.save(deviceToken);
    } catch (error) {
      console.error('Error registering device token:', error);
      // Create an inactive record to prevent repeated registration attempts
      try {
        const deviceToken = this.deviceTokenRepository.create({
          user: { user_id: userId } as User,
          token: token.substring(0, 100), // Truncate if too long
          platform,
          isActive: false,
        });
        return this.deviceTokenRepository.save(deviceToken);
      } catch (innerError) {
        console.error('Failed to save even inactive token:', innerError);
        throw error; // Re-throw original error if we can't even save an inactive token
      }
    }
  }

  private async sendPushNotification(
    user: User,
    message: string,
    type: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const deviceTokens = await this.deviceTokenRepository.find({
        where: { user: { user_id: user.user_id }, isActive: true },
      });

      if (!deviceTokens.length) {
        console.log(`No device tokens found for user ${user.user_id}`);
        return;
      }

      // Get notification title based on type
      let title: string;
      switch (type) {
        case 'message':
          title = 'New Message';
          break;
        case 'match':
          title = 'New Match!';
          break;
        case 'like':
          title = 'New Like';
          break;
        case 'call':
          title = 'Incoming Call';
          break;
        case 'system':
          title = 'Matcha';
          break;
        default:
          title = 'Matcha Notification';
      }

      console.log(`Preparing push notification for user ${user.user_id}:`, {
        title,
        body: message,
        tokens: deviceTokens.map((dt) => dt.token),
      });

      const messages: ExpoPushMessage[] = deviceTokens
        .filter(({ token }) => Expo.isExpoPushToken(token))
        .map(({ token, platform }) => ({
          to: token,
          title,
          body: message,
          sound: 'default',
          // Standard notification fields
          badge: 1,
          priority: 'high',
          // Add proper Android channel - critical for visibility
          channelId: 'default',
          // Include specific fields for iOS
          _displayInForeground: true,
          // Add more context/data to help the app process the notification
          data: {
            type,
            notification_type: type,
            user_id: user.user_id,
            timestamp: new Date().getTime(),
            message,
            // Include conversation data for message notifications
            ...(type === 'message' && {
              messageData: {
                sender_id: user.user_id,
                sender_name: user.full_name,
              },
            }),
            ...metadata, // Include additional metadata if provided
          },
        }));

      if (!messages.length) {
        return;
      }

      const chunks = this.expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        try {
          console.log('Sending push notification chunk');
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          console.log(
            'Push notification response:',
            JSON.stringify(ticketChunk),
          );

          ticketChunk.forEach((ticket, index) => {
            if (ticket.status === 'error') {
              console.error('Push notification error:', ticket.message);

              if (
                ticket.details &&
                ticket.details.error === 'DeviceNotRegistered'
              ) {
                const token = messages[index].to as string;
                console.log('Deactivating invalid token:', token);
                this.deactivateToken(token);
              }
            } else if (ticket.status === 'ok') {
              console.log(
                'Push notification sent successfully with ID:',
                ticket.id,
              );
            }
          });
        } catch (error) {
          console.error('Failed to send push notifications:', error);
        }
      }
    } catch (error) {
      console.error('Error in sendPushNotification:', error);
    }
  }

  // Helper method to deactivate invalid tokens
  private async deactivateToken(token: string): Promise<void> {
    await this.deviceTokenRepository.update({ token }, { isActive: false });
    console.log(`Deactivated invalid token: ${token}`);
  }
}
