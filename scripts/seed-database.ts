import * as fs from 'fs';
import * as path from 'path';

import { Match, MatchStatus } from '../src/match/match.entity';

import AppDataSource from '../src/config/typeorm.config';
import { Conversation } from '../src/converstation/converstation.entity';
import { Interest } from '../src/interest/entities/interest.entity';
import { Message } from '../src/message/message.entity';
import { Notification } from '../src/notification/notification.entity';
import { Point } from 'geojson';
import { User } from '../src/user/entities/user.entity';
import { UserBlock } from '../src/user-block/entities/user-block.entity';
import { UserInterest } from '../src/user-interest/entities/user-interest.entity';
import { UserPhoto } from '../src/user-photo/entities/user-photo.entity';
import { UserSettings } from '../src/user-settings/entities/user-settings.entity';
import { v2 as cloudinary } from 'cloudinary';
import { faker } from '@faker-js/faker/locale/vi';

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
  'Football',
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

// Cloudinary configuration
function setupCloudinaryConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Haversine formula to compute distance in km
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

// Split cities by distance to Hanoi
const HANOI_CENTER = { lat: 21.0285, lng: 105.8542 };
const MAX_NEAR_DISTANCE_KM = 200;
const NEAR_CITIES = Object.entries(CITIES_NEAR_HANOI)
  .filter(
    ([_, c]) =>
      calculateDistance(c.lat, c.lng, HANOI_CENTER.lat, HANOI_CENTER.lng) <=
      MAX_NEAR_DISTANCE_KM,
  )
  .map(([n]) => n);
const FAR_CITIES = Object.entries(CITIES_NEAR_HANOI)
  .filter(
    ([_, c]) =>
      calculateDistance(c.lat, c.lng, HANOI_CENTER.lat, HANOI_CENTER.lng) >
      MAX_NEAR_DISTANCE_KM,
  )
  .map(([n]) => n);

// Generate location: 80% near, 20% far
function generateLocation(): { location: Point; address: string } {
  const useNear = Math.random() < 0.8;
  const pool = useNear ? NEAR_CITIES : FAR_CITIES;
  const cityName = faker.helpers.arrayElement(pool);
  const { lat: baseLat, lng: baseLng } = CITIES_NEAR_HANOI[cityName];
  const variance = useNear ? 0.1 : 0.2;
  let lat = baseLat + (Math.random() - 0.5) * variance;
  let lng = baseLng + (Math.random() - 0.5) * variance;
  const d = calculateDistance(lat, lng, HANOI_CENTER.lat, HANOI_CENTER.lng);
  if (
    (useNear && d > MAX_NEAR_DISTANCE_KM) ||
    (!useNear && d <= MAX_NEAR_DISTANCE_KM)
  ) {
    return generateLocation();
  }
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

// ... existing code ...

async function seedDatabase() {
  await AppDataSource.initialize();
  setupCloudinaryConfig();
  await AppDataSource.query(`
  DO $$
  DECLARE r RECORD;
  BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('migrations','typeorm_metadata') LOOP
      EXECUTE format('TRUNCATE TABLE %I CASCADE;', r.tablename);
    END LOOP;
  END$$;
  `);

  console.time('Database seeding');

  // Seed Interests - batch insert
  console.time('Seeding interests');
  const interestRepo = AppDataSource.getRepository(Interest);
  const savedInterests = await interestRepo.save(
    INTERESTS.map((n) => ({ interest_name: n }) as Interest),
  );
  console.timeEnd('Seeding interests');

  // Prepare user data in batch
  console.time('Preparing user data');
  const userRepo = AppDataSource.getRepository(User);
  const userData: Array<Partial<User>> = [];

  // Add test users
  userData.push({
    email: 'test@example.com',
    password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
    full_name: 'Test User',
    phone_number: '0123456789',
    birthdate: faker.date.between({ from: '1990-01-01', to: '2005-12-31' }),
    gender: 'male',
    location: { type: 'Point', coordinates: [106.6297, 10.8231] } as Point,
    bio: 'Test',
    is_online: true,
    is_verified: true,
    last_active: new Date(),
  });

  userData.push({
    email: 'test1@example.com',
    password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
    full_name: 'Test User 2',
    phone_number: '0123453214',
    birthdate: faker.date.between({ from: '1990-01-01', to: '2005-12-31' }),
    gender: 'male',
    location: { type: 'Point', coordinates: [106.6297, 10.8231] } as Point,
    bio: 'Test',
    is_online: true,
    is_verified: true,
    last_active: new Date(),
  });

  userData.push({
    email: 'admin@matcha.com',
    password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
    full_name: 'Admin User',
    phone_number: '029382329899',
    gender: 'male',
    role: 'admin',
    birthdate: faker.date.between({ from: '1990-01-01', to: '2005-12-31' }),
    location: { type: 'Point', coordinates: [106.6297, 10.8231] } as Point,
    bio: 'Admin',
    is_online: true,
    is_verified: true,
    last_active: new Date(),
  });

  userData.push({
    email: 'banned@matcha.com',
    password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
    full_name: 'Banned Account',
    phone_number: '0934567890',
    birthdate: faker.date.between({ from: '1990-01-01', to: '2005-12-31' }),
    gender: 'male',
    location: { type: 'Point', coordinates: [105.8542, 21.0285] } as Point,
    bio: 'This account has been banned for violating community guidelines',
    is_online: false,
    is_verified: true,
    last_active: faker.date.past(),
    is_banned: true,
  });

  // Generate bulk user data 700
  for (let i = 0; i < 3; i++) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const { location } = generateLocation();
    userData.push({
      email: faker.internet.email(),
      password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
      full_name: faker.person.fullName({ sex: gender }),
      phone_number: faker.helpers.replaceSymbols('0#########'),
      birthdate: faker.date.between({ from: '1998-01-01', to: '2005-12-31' }),
      gender,
      location,
      bio: faker.lorem.paragraph(),
      is_online: faker.datatype.boolean(),
      is_verified: false,
      last_active: faker.date.recent(),
    });
  }
  for (let i = 0; i < 100; i++) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const { location } = generateLocation();
    userData.push({
      email: faker.internet.email(),
      password: '$2b$10$kr0NomLudHM9z43zRD9zzOzhdBy79TXOO68eETFJ1CZ37mY37PEcu',
      full_name: faker.person.fullName({ sex: gender }),
      phone_number: faker.helpers.replaceSymbols('0#########'),
      birthdate: faker.date.between({ from: '1990-01-01', to: '1999-12-31' }),
      gender,
      location,
      bio: faker.lorem.paragraph(),
      is_online: faker.datatype.boolean(),
      is_verified: false,
      last_active: faker.date.recent(),
    });
  }
  console.timeEnd('Preparing user data');

  // Batch insert users
  console.time('Seeding users');
  const users = await userRepo.save(userData as User[]);
  console.timeEnd('Seeding users');

  // Prepare settings data in batch
  console.time('Seeding user settings');
  const settingsRepo = AppDataSource.getRepository(UserSettings);
  const settingsData = users.map(
    (u) =>
      ({
        user: u,
        distance_preference: faker.number.int({ min: 1, max: 50 }),
        min_age_preference: 18,
        max_age_preference: 35,
        show_online_status: faker.datatype.boolean(),
        privacy_age: 'public',
        privacy_bio: 'public',
        privacy_interests: 'public',
        privacy_photos: 'public',
        created_at: new Date(),
        updated_at: new Date(),
      }) as Omit<UserSettings, 'settings_id'>,
  );
  await settingsRepo.save(settingsData);
  console.timeEnd('Seeding user settings');

  // Prepare and insert user interests in batch
  console.time('Seeding user interests');
  const uiRepo = AppDataSource.getRepository(UserInterest);
  const userInterestsData: Partial<UserInterest>[] = [];

  for (const u of users) {
    const interestPercentage = faker.number.float({ min: 0.5, max: 0.8 });
    const interestCount = Math.floor(INTERESTS.length * interestPercentage);
    const picks = faker.helpers.arrayElements(savedInterests, {
      min: interestCount,
      max: interestCount,
    });

    picks.forEach((i) => {
      userInterestsData.push({
        user: u,
        interest: i,
      });
    });
  }

  // Insert in chunks of 1000 to avoid memory issues
  const chunkSize = 1000;
  for (let i = 0; i < userInterestsData.length; i += chunkSize) {
    const chunk = userInterestsData.slice(i, i + chunkSize);
    await uiRepo.save(chunk);
  }
  console.timeEnd('Seeding user interests');

  // Seed Photos - optimize with parallel processing
  console.time('Seeding photos');
  const seedPaths = getSeedImages(path.join(__dirname, 'images'));
  const uploaded = seedPaths.length
    ? await uploadAllSeedImages(
        seedPaths,
        process.env.CLOUDINARY_FOLDER || 'seed-user-photos',
      )
    : [];

  const photoRepo = AppDataSource.getRepository(UserPhoto);
  const photosData: Partial<UserPhoto>[] = [];

  for (const u of users) {
    const picks = uploaded.length
      ? faker.helpers.arrayElements(uploaded, {
          min: 1,
          max: Math.min(5, uploaded.length),
        })
      : [
          {
            originalUrl: faker.image.avatar(),
            thumbnailUrl: faker.image.avatar(),
            publicId: faker.string.uuid(),
            is_profile_picture: true,
          },
        ];

    picks.forEach((p, i) => {
      photosData.push({
        user: u,
        photo_url: p.originalUrl,
        photo_url_thumbnail: p.thumbnailUrl,
        public_id: p.publicId,
        is_profile_picture: i === 0,
        uploaded_at: faker.date.recent(),
      });
    });
  }

  // Insert photos in chunks
  for (let i = 0; i < photosData.length; i += chunkSize) {
    const chunk = photosData.slice(i, i + chunkSize);
    await photoRepo.save(chunk);
  }
  console.timeEnd('Seeding photos');

  // Seed Matches
  console.time('Seeding matches');
  const matchRepo = AppDataSource.getRepository(Match);
  const matchesData: Partial<Match>[] = [];

  // Ensure test users match
  matchesData.push({
    user1: users[0],
    user2: users[1],
    match_status: MatchStatus.ACCEPTED,
    liked_at: faker.date.past({ years: 0.1 }),
    matched_at: new Date(),
  });

  // Generate other matches
  for (let i = 1; i < users.length; i++) {
    const count = faker.number.int({ min: 0, max: 5 });
    for (let j = 0; j < count; j++) {
      const other = users[faker.number.int({ min: 1, max: users.length - 1 })];
      if (other.user_id !== users[i].user_id) {
        matchesData.push({
          user1: users[i],
          user2: other,
          match_status: faker.helpers.arrayElement([
            MatchStatus.LIKED,
            MatchStatus.REJECTED,
            MatchStatus.ACCEPTED,
            MatchStatus.PENDING,
          ]),
          liked_at: faker.date.past({ years: 0.1 }),
          matched_at: new Date(),
        });
      }
    }
  }

  // Insert matches in chunks
  for (let i = 0; i < matchesData.length; i += chunkSize) {
    const chunk = matchesData.slice(i, i + chunkSize);
    await matchRepo.save(chunk);
  }
  console.timeEnd('Seeding matches');

  // Seed Conversations & Messages using batch inserts
  console.time('Seeding conversations');
  const convRepo = AppDataSource.getRepository(Conversation);
  const msgRepo = AppDataSource.getRepository(Message);

  // Get all ACCEPTED matches
  const matches = await matchRepo.find({
    where: { match_status: MatchStatus.ACCEPTED },
    relations: ['user1', 'user2'],
  });

  // Create conversations in batch
  const conversationsData = matches.map((m) => ({
    user1: m.user1,
    user2: m.user2,
    created_at: faker.date.recent(),
  }));

  const savedConversations = await convRepo.save(conversationsData);
  console.timeEnd('Seeding conversations');

  // Create messages in batch
  console.time('Seeding messages');
  const messagesData: Partial<Message>[] = [];

  savedConversations.forEach((conv) => {
    const num = faker.number.int({ min: 1, max: 10 });
    for (let k = 0; k < num; k++) {
      const match = matches.find(
        (m) =>
          m.user1.user_id === conv.user1.user_id &&
          m.user2.user_id === conv.user2.user_id,
      );
      if (!match) continue;

      const sender = faker.helpers.arrayElement([match.user1, match.user2]);
      const sentAt = faker.date.recent();

      messagesData.push({
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
      });
    }
  });

  // Insert messages in chunks
  for (let i = 0; i < messagesData.length; i += chunkSize) {
    const chunk = messagesData.slice(i, i + chunkSize);
    await msgRepo.save(chunk);
  }
  console.timeEnd('Seeding messages');

  // Seed Notifications in batch
  console.time('Seeding notifications');
  const notifRepo = AppDataSource.getRepository(Notification);
  const notificationsData: Partial<Notification>[] = [];

  for (const u of users) {
    const n = faker.number.int({ min: 0, max: 5 });
    for (let x = 0; x < n; x++) {
      const type = faker.helpers.arrayElement(['message', 'match', 'block']);
      notificationsData.push({
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
      });
    }
  }

  // Insert notifications in chunks
  for (let i = 0; i < notificationsData.length; i += chunkSize) {
    const chunk = notificationsData.slice(i, i + chunkSize);
    await notifRepo.save(chunk);
  }
  console.timeEnd('Seeding notifications');

  // Seed Blocks in batch
  console.time('Seeding blocks');
  const blockRepo = AppDataSource.getRepository(UserBlock);
  const blocksData: Partial<UserBlock>[] = [];

  for (const b of users) {
    if (faker.datatype.boolean()) {
      const blocked = faker.helpers.arrayElement(
        users.filter((u) => u.user_id !== b.user_id),
      );
      blocksData.push({
        blocker: b,
        blocked,
        blocked_at: faker.date.recent(),
      });
    }
  }

  // Insert blocks in chunks if needed
  if (blocksData.length > 0) {
    for (let i = 0; i < blocksData.length; i += chunkSize) {
      const chunk = blocksData.slice(i, i + chunkSize);
      await blockRepo.save(chunk);
    }
  }
  console.timeEnd('Seeding blocks');

  console.timeEnd('Database seeding');
  await AppDataSource.destroy();
  console.log('Seeding complete');
}
seedDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
