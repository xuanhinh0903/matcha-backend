import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1750931700175 implements MigrationInterface {
    name = 'Migration1750931700175'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_message_conversation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_message_sender"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_message_sent_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_message_conversation_sent_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_conversation_user1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_conversation_user2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_conversation_users"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "avatar_url"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_firebase_uid"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "firebase_uid"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "firebase_uid" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_40fe3048b17f675b652c1999270" UNIQUE ("firebase_uid")`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_f8c996f451b3af18dc374210d7" ON "message" ("conversationConversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_402bc1c95c30e2798cd2025c8c" ON "user_photo" ("is_profile_picture") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_758b8ce7c18b9d347461b30228" ON "user" ("user_id") `);
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
        await queryRunner.query(`DROP INDEX "public"."IDX_758b8ce7c18b9d347461b30228"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_402bc1c95c30e2798cd2025c8c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8c996f451b3af18dc374210d7"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_40fe3048b17f675b652c1999270"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "firebase_uid"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "firebase_uid" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_firebase_uid" UNIQUE ("firebase_uid")`);
        await queryRunner.query(`ALTER TABLE "user" ADD "avatar_url" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_conversation_users" ON "conversation" ("user1UserId", "user2UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_conversation_user2" ON "conversation" ("user2UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_conversation_user1" ON "conversation" ("user1UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_message_conversation_sent_at" ON "message" ("conversationConversationId", "sent_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_message_sent_at" ON "message" ("sent_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_message_sender" ON "message" ("senderUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_message_conversation" ON "message" ("conversationConversationId") `);
    }

}
