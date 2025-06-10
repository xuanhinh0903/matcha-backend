import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1746632203523 implements MigrationInterface {
    name = 'Migration1746632203523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "last_message"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "last_message_at"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "unread_count"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation" ADD "unread_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "last_message_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "last_message" text`);
    }

}
