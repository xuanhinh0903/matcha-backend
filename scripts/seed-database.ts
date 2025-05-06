import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';
import * as path from 'path';

import { faker } from '@faker-js/faker/locale/vi';
import { Point } from 'geojson';
import AppDataSource from '../src/config/typeorm.config';
import { Conversation } from '../src/converstation/converstation.entity';
import { Interest } from '../src/interest/entities/interest.entity';
import { Match, MatchStatus } from '../src/match/match.entity';
import { Message } from '../src/message/message.entity';
import { Notification } from '../src/notification/notification.entity';
import { UserBlock } from '../src/user-block/entities/user-block.entity';
import { UserInterest } from '../src/user-interest/entities/user-interest.entity';
import { UserPhoto } from '../src/user-photo/entities/user-photo.entity';
import { UserSettings } from '../src/user-settings/entities/user-settings.entity';
import { User } from '../src/user/entities/user.entity';

interface CityCoordinates {
  lat: number;
  lng: number;
}

// Define coordinates for cities near Hanoi
const CITIES_NEAR_HANOI: Record<string, CityCoordinates> = {
  'Hà Nội': { lat: 21.0285, lng: 105.8542 },
  'Hải Phòng': { lat: 20.8449, lng: 106.6881 },
  Vinh: { lat: 18.6733, lng: 105.6922 },
  'Thái Nguyên': { lat: 21.5942, lng: 105.848 },
  'Nam Định': { lat: 20.4253, lng: 106.1682 },
  'Hạ Long': { lat: 20.9515, lng: 107.0798 },
  'Thanh Hóa': { lat: 19.8066, lng: 105.7852 },
  'Việt Trì': { lat: 21.3261, lng: 105.4022 },
  'Ninh Bình': { lat: 20.2487, lng: 105.9745 },
  'Bắc Giang': { lat: 21.2731, lng: 106.1947 },
  'Bắc Ninh': { lat: 21.1213, lng: 106.111 },
  'Lạng Sơn': { lat: 21.8431, lng: 106.7627 },
  'Cao Bằng': { lat: 22.6666, lng: 106.268 },
};

const INTERESTS = [
  /* ... same interest array as before ... */ 'Football',
  'Basketball',
  'Tennis',
  'Swimming',
  'Hiking',
  'Yoga',
  'Running',
  'Cycling',
  'Volleyball',
  'Golf',
  'Martial Arts',
  'Rock Climbing',
  'Skiing',
  'Surfing',
  'Boxing',
  'Photography',
  'Painting',
  'Drawing',
  'Sculpture',
  'Theatre',
  'Museums',
  'Classical Music',
  'Orchestra',
  'Ballet',
  'Poetry',
  'Literature',
  'Art Galleries',
  'Movies',
  'TV Shows',
  'Video Games',
  'Board Games',
  'Concerts',
  'Festivals',
  'Comedy Shows',
  'Karaoke',
  'Escape Rooms',
  'Puzzles',
  'Anime',
  'Fine Dining',
  'Street Food',
  'Cafes',
  'Cocktails',
  'Wine Tasting',
  'Craft Beer',
  'Baking',
  'Cooking',
  'BBQ',
  'Vegetarian Cuisine',
  'Food Trucks',
  'Brunch',
  'Programming',
  'AI',
  'Blockchain',
  'Startups',
  'Robotics',
  'VR/AR',
  'Smartphones',
  'PC Gaming',
  'Crypto',
  'Tech Gadgets',
  'Backpacking',
  'Luxury Travel',
  'Road Trips',
  'Adventure Travel',
  'Solo Travel',
  'City Breaks',
  'Cultural Tourism',
  'Beach Holidays',
  'Camping',
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
  'Rock',
  'Pop',
  'Jazz',
  'Hip Hop',
  'R&B',
  'Classical',
  'Electronic',
  'Country',
  'Indie',
  'K-pop',
  'Metal',
  'Punk',
  'Blues',
  'Folk',
  'Meditation',
  'Mindfulness',
  'Reading',
  'Writing',
  'Volunteering',
  'Environmentalism',
  'Sustainability',
  'Minimalism',
  'Fitness',
  'Fashion',
  'Shopping',
  'Dancing',
  'LGBTQ+ Culture',
  'Activism',
  'Spirituality',
];

// Configure Cloudinary
function setupCloudinaryConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Haversine formula to ensure within 400km
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateLocationNearHanoi(): { location: Point; address: string } {
  const cityNames = Object.keys(CITIES_NEAR_HANOI);
  const cityName = faker.helpers.arrayElement(cityNames);
  const { lat: baseLat, lng: baseLng } = CITIES_NEAR_HANOI[cityName];
  const variance = cityName === 'Hà Nội' ? 0.1 : 0.2;
  let lat = baseLat + (Math.random() - 0.5) * variance;
  let lng = baseLng + (Math.random() - 0.5) * variance;
  if (calculateDistance(lat, lng, 21.0285, 105.8542) > 400)
    return generateLocationNearHanoi();
  return {
    location: { type: 'Point', coordinates: [lng, lat] },
    address: `${faker.location.streetAddress()}, ${cityName}, Việt Nam`,
  };
}

function getSeedImages(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((f) => /\.(jpe?g|png)$/i.test(f))
      .map((f) => path.join(dirPath, f));
  } catch {
    return [];
  }
}

async function uploadAllSeedImages(images: string[], folder: string) {
  const uploads = [];
  for (const img of images) {
    const fileName = path.basename(img, path.extname(img));
    let res;
    try {
      res = await cloudinary.api.resource(`${folder}/${fileName}`);
      uploads.push({
        originalUrl: res.secure_url,
        thumbnailUrl: res.derived?.[0]?.secure_url || res.secure_url,
        publicId: res.public_id,
      });
      continue;
    } catch (err) {
      // Robust error check for Cloudinary 404
      const httpCode = err?.http_code || err?.error?.http_code;
      if (httpCode !== 404) throw err;
      res = await cloudinary.uploader.upload(img, {
        folder,
        public_id: fileName,
        eager: [{ width: 150, height: 150, crop: 'thumb' }],
      });
      uploads.push({
        originalUrl: res.secure_url,
        thumbnailUrl: res.eager?.[0]?.secure_url!,
        publicId: res.public_id,
      });
    }
  }
  return uploads;
}

async function seedDatabase() {
  await AppDataSource.initialize();
  setupCloudinaryConfig();
  // await AppDataSource.dropDatabase();
  // await AppDataSource.synchronize();
  // Clear data
  // await Promise.all([
  //   AppDataSource.getRepository(UserSettings).delete({}),
  //   AppDataSource.getRepository(UserInterest).delete({}),
  //   AppDataSource.getRepository(Message).delete({}),
  //   AppDataSource.getRepository(Conversation).delete({}),
  //   AppDataSource.getRepository(Notification).delete({}),
  //   AppDataSource.getRepository(DeviceToken).delete({}),
  //   AppDataSource.getRepository(UserBlock).delete({}),
  //   AppDataSource.getRepository(Match).delete({}),
  //   AppDataSource.getRepository(UserPhoto).delete({}),
  //   AppDataSource.getRepository(Report).delete({}),
  //   AppDataSource.getRepository(User).delete({}),
  //   AppDataSource.getRepository(Interest).delete({}),
  // ]);
  await AppDataSource.query(`
  DO $$
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN (
          'migrations',               -- your migrations table
          'typeorm_metadata'          -- TypeORM’s metadata table, if used
        )
    LOOP
      EXECUTE format('TRUNCATE TABLE %I CASCADE;', r.tablename);
    END LOOP;
  END
  $$;
`);

  // await AppDataSource.query(`
  //   DO $$
  //   DECLARE
  //       statements CURSOR FOR
  //           SELECT tablename FROM pg_tables
  //           WHERE schemaname = 'public' AND
  //                 tablename NOT IN ('migrations', 'typeorm_metadata');
  //   BEGIN
  //       EXECUTE 'SET session_replication_role = replica;';

  //       FOR stmt IN statements LOOP
  //           EXECUTE 'TRUNCATE TABLE ' || quote_ident(stmt.tablename) || ' CASCADE;';
  //       END LOOP;

  //       EXECUTE 'SET session_replication_role = DEFAULT;';
  //   END $$;
  // `);
  // Interests
  const interestRepo = AppDataSource.getRepository(Interest);
  const savedInterests = await interestRepo.save(
    INTERESTS.map((n) => ({ interest_name: n }) as Interest),
  );

  // Users
  const userRepo = AppDataSource.getRepository(User);
  const users: User[] = [];
  // test users
  const testUser = await userRepo.save({
    email: 'test@example.com',
    password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
    full_name: 'Test User',
    phone_number: '0123456789',
    birthdate: faker.date.between({
      from: '1990-01-01',
      to: '2005-12-31',
    }),
    gender: 'male',
    location: { type: 'Point', coordinates: [106.6297, 10.8231] },
    bio: 'Test',
    is_online: true,
    is_verified: true,
    last_active: new Date(),
  } as any);
  users.push(testUser);

  const testUser22 = await userRepo.save({
    email: 'test1@example.com',
    password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
    full_name: 'Test User',
    phone_number: '0123453214',
    birthdate: faker.date.between({
      from: '1990-01-01',
      to: '2005-12-31',
    }),
    gender: 'male',
    location: { type: 'Point', coordinates: [106.6297, 10.8231] },
    bio: 'Test',
    is_online: true,
    is_verified: true,
    last_active: new Date(),
  } as any);
  users.push(testUser22);

  for (let i = 0; i < 500; i++) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const { location } = generateLocationNearHanoi();
    const u = await userRepo.save({
      email: faker.internet.email(),
      password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
      full_name: faker.person.fullName({ sex: gender }),
      phone_number: faker.helpers.replaceSymbols('0#########'),
      birthdate: faker.date.between({
        from: '1990-01-01',
        to: '2005-12-31',
      }),
      gender,
      location,
      bio: faker.lorem.paragraph(),
      is_online: faker.datatype.boolean(),
      is_verified: false,
      last_active: faker.date.recent(),
    } as any);
    users.push(u);
  }

  // Settings
  const settingsRepo = AppDataSource.getRepository(UserSettings);
  await Promise.all(
    users.map((u) =>
      settingsRepo.save({
        user: u,
        distance_preference: faker.number.int({ min: 1, max: 50 }),
        gender_preference: faker.helpers.arrayElement([
          'male',
          'female',
          'all',
        ]),
        min_age_preference: 18,
        max_age_preference: 45,
        show_online_status: faker.datatype.boolean(),
        privacy_age: 'private',
        privacy_bio: 'private',
        privacy_interests: 'private',
        privacy_photos: 'private',
        created_at: new Date(),
        updated_at: new Date(),
      }),
    ),
  );

  // UserInterests
  const uiRepo = AppDataSource.getRepository(UserInterest);
  for (const u of users) {
    const picks = faker.helpers.arrayElements(savedInterests, {
      min: 2,
      max: 5,
    });
    await Promise.all(
      picks.map((i) => uiRepo.save({ user: u, interest: i } as UserInterest)),
    );
  }

  // Photos
  const seedPaths = getSeedImages(path.join(__dirname, 'images'));
  const uploaded = seedPaths.length
    ? await uploadAllSeedImages(
        seedPaths,
        process.env.CLOUDINARY_FOLDER || 'seed-user-photos',
      )
    : [];
  const photoRepo = AppDataSource.getRepository(UserPhoto);
  for (const u of users) {
    const picks = uploaded.length
      ? faker.helpers.arrayElements(uploaded, {
          min: 1,
          max: Math.min(5, uploaded.length),
        })
      : Array.from({ length: 1 }).map(() => ({
          originalUrl: faker.image.avatar(),
          thumbnailUrl: faker.image.avatar(),
          publicId: faker.string.uuid(),
        }));
    picks.forEach(
      async (p, i) =>
        await photoRepo.save({
          user: u,
          photo_url: p.originalUrl,
          photo_url_thumbnail: p.thumbnailUrl,
          public_id: p.publicId,
          is_profile_picture: i === 0,
          uploaded_at: faker.date.recent(),
        } as UserPhoto),
    );
  }

  // Matches
  const matchRepo = AppDataSource.getRepository(Match);
  // specific match between testUser and second user
  // const testUser2 = users[1];
  await matchRepo.save({
    user1: users[0],
    user2: testUser22,
    match_status: MatchStatus.ACCEPTED,
    liked_at: faker.date.past({ years: 0.1 }),
    matched_at: new Date(),
  } as Match);

  // random matches for other users
  for (let i = 1; i < users.length; i++) {
    const count = faker.number.int({ min: 0, max: 5 });
    for (let j = 0; j < count; j++) {
      const other = users[faker.number.int({ min: 1, max: users.length - 1 })];
      if (other.user_id !== users[i].user_id) {
        await matchRepo.save({
          user1: users[i],
          user2: other,
          match_status: faker.helpers.arrayElement([
            MatchStatus.LIKED,
            MatchStatus.REJECTED,
            MatchStatus.ACCEPTED,
            MatchStatus.PENDING,
            // MatchStatus.UNMATCHED,
          ]),
          liked_at: faker.date.past({ years: 0.1 }),
          matched_at: new Date(),
        } as Match);
      }
    }
  }

  // Conversations & Messages
  const convRepo = AppDataSource.getRepository(Conversation);
  const msgRepo = AppDataSource.getRepository(Message);
  const matches = await matchRepo.find({
    where: { match_status: MatchStatus.ACCEPTED },
    relations: ['user1', 'user2'],
  });
  for (const m of matches) {
    const conv = await convRepo.save({
      user1: m.user1,
      user2: m.user2,
      created_at: faker.date.recent(),
    } as Conversation);
    const numMsgs = faker.number.int({ min: 1, max: 10 });
    for (let k = 0; k < numMsgs; k++) {
      const sender = faker.helpers.arrayElement([m.user1, m.user2]);
      const sentAt = faker.date.recent();
      await msgRepo.save({
        conversation: conv,
        sender,
        content_type: faker.helpers.arrayElement([
          'text',
          'emoji',
          'image',
          'sticker',
          'gif',
        ]),
        content: faker.lorem.sentence(),
        sent_at: sentAt,
        read_at:
          Math.random() > 0.5
            ? faker.date.between({ from: sentAt, to: new Date() })
            : null,
      } as Message);
    }
  }

  // Notifications
  const notifRepo = AppDataSource.getRepository(Notification);
  for (const u of users) {
    const nCount = faker.number.int({ min: 0, max: 5 });
    for (let x = 0; x < nCount; x++) {
      const type = faker.helpers.arrayElement(['message', 'match', 'block']);
      await notifRepo.save({
        user: u,
        notification_type: type,
        notification_content:
          type === 'message'
            ? 'Bạn có tin nhắn mới'
            : type === 'match'
              ? 'Bạn có một kết nối mới'
              : 'Một người dùng đã chặn bạn',
        notification_status: faker.helpers.arrayElement(['read', 'unread']),
        sent_at: faker.date.recent(),
      } as Notification);
    }
  }

  // Blocks
  const blockRepo = AppDataSource.getRepository(UserBlock);
  for (const blocker of users) {
    if (faker.datatype.boolean()) {
      const blocked = faker.helpers.arrayElement(
        users.filter((u) => u.user_id !== blocker.user_id),
      );
      await blockRepo.save({
        blocker,
        blocked,
        blocked_at: faker.date.recent(),
      } as UserBlock);
    }
  }

  await AppDataSource.destroy();
  console.log('Seeding complete');
}

seedDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
