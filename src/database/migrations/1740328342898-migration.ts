import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1740328342898 implements MigrationInterface {
  name = 'Migration1740328342898';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_block" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(`DROP TYPE "public"."user_block_status_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_block_status_enum" AS ENUM('active', 'unblocked')`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_block" ADD "status" "public"."user_block_status_enum" NOT NULL DEFAULT 'active'`,
    );
  }
}
