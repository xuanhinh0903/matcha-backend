import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1742094120990 implements MigrationInterface {
    name = 'Migration1742094120990'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "device_token" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "platform" character varying NOT NULL, "lastUsed" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "PK_592ce89b9ea1a268d6140f60422" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TYPE "public"."notification_notification_type_enum" RENAME TO "notification_notification_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_notification_type_enum" AS ENUM('message', 'match', 'block', 'like', 'system')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "notification_type" TYPE "public"."notification_notification_type_enum" USING "notification_type"::"text"::"public"."notification_notification_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_notification_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_notification_type_enum" RENAME TO "notification_notification_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_notification_type_enum" AS ENUM('message', 'match', 'block', 'like', 'system')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "notification_type" TYPE "public"."notification_notification_type_enum" USING "notification_type"::"text"::"public"."notification_notification_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_notification_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "device_token" ADD CONSTRAINT "FK_27b5b157cb9fb5fc50aa2a0f661" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "device_token" DROP CONSTRAINT "FK_27b5b157cb9fb5fc50aa2a0f661"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_notification_type_enum_old" AS ENUM('message', 'match', 'block')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "notification_type" TYPE "public"."notification_notification_type_enum_old" USING "notification_type"::"text"::"public"."notification_notification_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_notification_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_notification_type_enum_old" RENAME TO "notification_notification_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."notification_notification_type_enum_old" AS ENUM('message', 'match', 'block')`);
        await queryRunner.query(`ALTER TABLE "notification" ALTER COLUMN "notification_type" TYPE "public"."notification_notification_type_enum_old" USING "notification_type"::"text"::"public"."notification_notification_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."notification_notification_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."notification_notification_type_enum_old" RENAME TO "notification_notification_type_enum"`);
        await queryRunner.query(`DROP TABLE "device_token"`);
    }

}
