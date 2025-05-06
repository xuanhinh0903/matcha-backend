import { Point } from 'geojson';
import { UserInterest } from 'src/user-interest/entities/user-interest.entity';
import { UserPhoto } from '../../user-photo/entities/user-photo.entity';

export interface UserInfo {
  user_id: number;
  email: string;
  phone_number?: string;
  full_name?: string;
  birthdate?: Date;
  gender?: string;
  location?: Point;
  bio?: string;
  last_active?: Date;
  is_online: boolean;
  is_verified: boolean;
  interests: UserInterest[];
  photos: UserPhoto[];
  matchStats: {
    totalMatches: number;
    likesReceived: number;
    matchRate: number;
  };
}
