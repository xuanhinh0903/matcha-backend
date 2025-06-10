import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1742999678777 implements MigrationInterface {
    name = 'Migration1742999678777'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" ADD "type" character varying`);
        await queryRunner.query(`ALTER TABLE "message" ADD "callStatus" character varying`);
        await queryRunner.query(`ALTER TABLE "message" ADD "duration" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "duration"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "callStatus"`);
        await queryRunner.query(`ALTER TABLE "message" DROP COLUMN "type"`);
    }

}
