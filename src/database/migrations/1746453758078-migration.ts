import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1746453758078 implements MigrationInterface {
    name = 'Migration1746453758078'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "distance_preference"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "gender_preference"`);
        await queryRunner.query(`DROP TYPE "public"."user_settings_gender_preference_enum"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "min_age_preference"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "max_age_preference"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "show_online_status"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "receive_notifications"`);
        await queryRunner.query(`CREATE TYPE "public"."user_settings_privacy_photos_enum" AS ENUM('private', 'matches', 'public')`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "privacy_photos" "public"."user_settings_privacy_photos_enum" NOT NULL DEFAULT 'public'`);
        await queryRunner.query(`CREATE TYPE "public"."user_settings_privacy_bio_enum" AS ENUM('private', 'matches', 'public')`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "privacy_bio" "public"."user_settings_privacy_bio_enum" NOT NULL DEFAULT 'public'`);
        await queryRunner.query(`CREATE TYPE "public"."user_settings_privacy_age_enum" AS ENUM('private', 'matches', 'public')`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "privacy_age" "public"."user_settings_privacy_age_enum" NOT NULL DEFAULT 'matches'`);
        await queryRunner.query(`CREATE TYPE "public"."user_settings_privacy_interests_enum" AS ENUM('private', 'matches', 'public')`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "privacy_interests" "public"."user_settings_privacy_interests_enum" NOT NULL DEFAULT 'public'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "privacy_interests"`);
        await queryRunner.query(`DROP TYPE "public"."user_settings_privacy_interests_enum"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "privacy_age"`);
        await queryRunner.query(`DROP TYPE "public"."user_settings_privacy_age_enum"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "privacy_bio"`);
        await queryRunner.query(`DROP TYPE "public"."user_settings_privacy_bio_enum"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN "privacy_photos"`);
        await queryRunner.query(`DROP TYPE "public"."user_settings_privacy_photos_enum"`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "receive_notifications" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "show_online_status" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "max_age_preference" integer NOT NULL DEFAULT '100'`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "min_age_preference" integer NOT NULL DEFAULT '18'`);
        await queryRunner.query(`CREATE TYPE "public"."user_settings_gender_preference_enum" AS ENUM('male', 'female', 'all')`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "gender_preference" "public"."user_settings_gender_preference_enum" NOT NULL DEFAULT 'all'`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD "distance_preference" integer NOT NULL DEFAULT '50'`);
    }

}
