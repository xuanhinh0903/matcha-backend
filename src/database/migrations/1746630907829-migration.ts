import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1746630907829 implements MigrationInterface {
    name = 'Migration1746630907829'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a568d84869b0b1564824f35536"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7aaf097429b888f9ecb544d614"`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "last_message" text`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "last_message_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD "unread_count" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TYPE "public"."match_match_status_enum" RENAME TO "match_match_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."match_match_status_enum" AS ENUM('liked', 'rejected', 'accepted', 'pending', 'unmatched')`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" TYPE "public"."match_match_status_enum" USING "match_status"::"text"::"public"."match_match_status_enum"`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."match_match_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."match_match_status_enum" RENAME TO "match_match_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."match_match_status_enum" AS ENUM('liked', 'rejected', 'accepted', 'pending', 'unmatched')`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" TYPE "public"."match_match_status_enum" USING "match_status"::"text"::"public"."match_match_status_enum"`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."match_match_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_CONV_USER1" ON "conversation" ("user1UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONV_USER2" ON "conversation" ("user2UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONV_CREATED_AT" ON "conversation" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONVERSATION_USERS" ON "conversation" ("user1UserId", "user2UserId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_CONVERSATION_USERS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONV_CREATED_AT"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONV_USER2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONV_USER1"`);
        await queryRunner.query(`CREATE TYPE "public"."match_match_status_enum_old" AS ENUM('liked', 'rejected', 'accepted', 'pending')`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" TYPE "public"."match_match_status_enum_old" USING "match_status"::"text"::"public"."match_match_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."match_match_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."match_match_status_enum_old" RENAME TO "match_match_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."match_match_status_enum_old" AS ENUM('liked', 'rejected', 'accepted', 'pending')`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" TYPE "public"."match_match_status_enum_old" USING "match_status"::"text"::"public"."match_match_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "match" ALTER COLUMN "match_status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."match_match_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."match_match_status_enum_old" RENAME TO "match_match_status_enum"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "unread_count"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "last_message_at"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP COLUMN "last_message"`);
        await queryRunner.query(`CREATE INDEX "IDX_7aaf097429b888f9ecb544d614" ON "conversation" ("user2UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a568d84869b0b1564824f35536" ON "conversation" ("user1UserId") `);
    }

}
