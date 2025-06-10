import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1745723544328 implements MigrationInterface {
    name = 'Migration1745723544328'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" ADD "callType" character varying(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "callType"`);
    }

}
