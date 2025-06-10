import { User } from '../src/user/entities/user.entity';
import { Match, MatchStatus } from '../src/match/match.entity';
import AppDataSource from '../src/config/typeorm.config';
import { faker } from '@faker-js/faker/locale/vi';

/**
 * Script to make 80% of users like a specific user (default: testUser)
 *
 * Usage:
 * 1. Compile the script: npm run build
 * 2. Run it: node dist/scripts/make-user-popular.js
 *
 * You can provide a custom user ID as an argument:
 * node dist/scripts/make-user-popular.js 2
 */

async function makeUserPopular() {
  try {
    // Initialize the database connection
    await AppDataSource.initialize();
    console.log('Database connection established');

    // Determine which user to make popular (default is user id 1 - test user)
    const targetUserId = process.argv[2] ? parseInt(process.argv[2], 10) : 1;

    // Get the target user
    const userRepository = AppDataSource.getRepository(User);
    const targetUser = await userRepository.findOne({
      where: { email: 'test@example.com' },
    });

    if (!targetUser) {
      console.error(`User with ID ${targetUserId} not found!`);
      process.exit(1);
    }

    console.log(
      `Making ${targetUser.full_name} (ID: ${targetUser.user_id}) popular...`,
    );

    // Now get all users except the target user
    const allOtherUsers = await userRepository
      .createQueryBuilder('user')
      .where('user.user_id != :targetUserId', { targetUserId })
      .getMany();

    console.log(`Found ${allOtherUsers.length} other users in the database`);

    // Calculate 80% of users
    const likeCount = Math.floor(allOtherUsers.length * 0.8);

    // Randomly select 80% of users
    const selectedUsers = faker.helpers.arrayElements(allOtherUsers, likeCount);
    console.log(
      `Selected ${selectedUsers.length} users to like ${targetUser.full_name}`,
    );

    // Get the match repository
    const matchRepository = AppDataSource.getRepository(Match);

    // Check which users already have a match record with the target user
    const existingMatches = await matchRepository.find({
      where: [
        { user2: { user_id: targetUser.user_id } },
        { user1: { user_id: targetUser.user_id } },
      ],
      relations: ['user1', 'user2'],
    });

    const existingMatchUserIds = new Set(
      existingMatches.map((match) =>
        match.user1.user_id === targetUser.user_id
          ? match.user2.user_id
          : match.user1.user_id,
      ),
    );

    console.log(
      `Found ${existingMatchUserIds.size} existing matches for ${targetUser.full_name}`,
    );

    // Create matches for users who don't already have a match
    let createdCount = 0;
    for (const user of selectedUsers) {
      // Skip if match already exists
      if (existingMatchUserIds.has(user.user_id)) {
        continue;
      }

      // Create a match where the other user likes the target user
      // Note: matched_at will be automatically set to the current timestamp by @CreateDateColumn()
      await matchRepository.save({
        user1: user, // Other user
        user2: targetUser, // Target user
        match_status: MatchStatus.LIKED, // They've liked the target but target hasn't responded
        liked_at: faker.date.recent({ days: 14 }), // Liked within last two weeks
        // Don't set matched_at to null, let TypeORM handle it with the @CreateDateColumn()
      });

      createdCount++;
    }

    console.log(
      `Successfully created ${createdCount} new likes for ${targetUser.full_name}`,
    );
    console.log(
      `${targetUser.full_name} now has ${createdCount + existingMatchUserIds.size} total likes/matches`,
    );

    console.log('Done! Script completed successfully.');
  } catch (error) {
    console.error('Error making user popular:', error);
  } finally {
    // Close the database connection
    await AppDataSource.destroy();
  }
}

// Run the script
makeUserPopular()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
