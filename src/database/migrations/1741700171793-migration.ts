import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1741700171793 implements MigrationInterface {
    name = 'Migration1741700171793'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "is_banned" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "ban_reason" text`);
        await queryRunner.query(`ALTER TABLE "user" ADD "banned_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "user" ADD "ban_expires_at" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "ban_expires_at"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "banned_at"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "ban_reason"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_banned"`);
    }

}
