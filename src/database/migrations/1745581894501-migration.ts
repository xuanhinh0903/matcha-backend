import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1745581894501 implements MigrationInterface {
    name = 'Migration1745581894501'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "is_verified" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_verified"`);
    }

}
