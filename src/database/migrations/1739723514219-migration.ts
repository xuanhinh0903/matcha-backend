import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1739723514219 implements MigrationInterface {
  name = 'Migration1739723514219';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column 'public_id' exists
    const table = await queryRunner.getTable('user_photo');
    const publicIdColumn = table?.findColumnByName('public_id');
    const photoUrlThumbnailColumn = table?.findColumnByName(
      'photo_url_thumbnail',
    );

    if (!publicIdColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_photo" ADD "public_id" character varying`,
      );
    }

    if (!photoUrlThumbnailColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_photo" ADD "photo_url_thumbnail" character varying`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "user_photo" ALTER COLUMN "photo_url" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_photo" ALTER COLUMN "is_profile_picture" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_photo" ALTER COLUMN "is_profile_picture" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_photo" ALTER COLUMN "is_profile_picture" SET DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_photo" ALTER COLUMN "is_profile_picture" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_photo" ALTER COLUMN "photo_url" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_photo" DROP COLUMN "photo_url_thumbnail"`,
    );
    await queryRunner.query(`ALTER TABLE "user_photo" DROP COLUMN "public_id"`);
  }
}
