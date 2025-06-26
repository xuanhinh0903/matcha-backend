import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   * Uses environment variables to configure Firebase
   */
  private initializeFirebase() {
    try {
      // Check if Firebase app is already initialized
      if (admin.apps.length === 0) {
        // Initialize Firebase app with project ID
        this.app = admin.initializeApp({
          projectId: this.configService.get('FIREBASE_PROJECT_ID'),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.app = admin.apps[0] as admin.app.App;
        this.logger.log('Using existing Firebase Admin SDK instance');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      throw error;
    }
  }

  /**
   * Verify Firebase ID token from frontend
   * @param idToken - Firebase ID token from Google Sign-In
   * @returns Decoded token with user information
   */
  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      // Verify the ID token and decode its payload
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      this.logger.log(`Token verified for user: ${decodedToken.uid}`);
      return decodedToken;
    } catch (error) {
      this.logger.error('Failed to verify Firebase ID token', error);
      throw new Error('Invalid Firebase token');
    }
  }

  /**
   * Get user information from Firebase
   * @param uid - Firebase user UID
   * @returns Firebase user record
   */
  async getUserByUid(uid: string): Promise<admin.auth.UserRecord> {
    try {
      const userRecord = await admin.auth().getUser(uid);
      this.logger.log(`Retrieved user info for UID: ${uid}`);
      return userRecord;
    } catch (error) {
      this.logger.error(`Failed to get user by UID: ${uid}`, error);
      throw new Error('User not found in Firebase');
    }
  }
} 