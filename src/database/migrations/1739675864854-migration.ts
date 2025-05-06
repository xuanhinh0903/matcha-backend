import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1739675864854 implements MigrationInterface {
    name = 'Migration1739675864854'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."match_match_status_enum" AS ENUM('liked', 'rejected', 'accepted', 'pending')`);
        await queryRunner.query(`CREATE TABLE "match" ("match_id" SERIAL NOT NULL, "match_status" "public"."match_match_status_enum" NOT NULL DEFAULT 'pending', "liked_at" TIMESTAMP, "matched_at" TIMESTAMP NOT NULL DEFAULT now(), "user1UserId" integer, "user2UserId" integer, CONSTRAINT "PK_2e7d516f3dc97d9e2f882212d2b" PRIMARY KEY ("match_id"))`);
        await queryRunner.query(`CREATE TABLE "conversation" ("conversation_id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user1UserId" integer, "user2UserId" integer, CONSTRAINT "PK_66e2b75e2704e382f3a4f2a5466" PRIMARY KEY ("conversation_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."message_content_type_enum" AS ENUM('text', 'emoji', 'sticker', 'image', 'gif')`);
        await queryRunner.query(`CREATE TABLE "message" ("message_id" SERIAL NOT NULL, "content_type" "public"."message_content_type_enum" NOT NULL, "content" text NOT NULL, "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "read_at" TIMESTAMP, "conversationConversationId" integer, "senderUserId" integer, CONSTRAINT "PK_06a563cdbd963a9f7cbcb25c447" PRIMARY KEY ("message_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notification_notification_type_enum" AS ENUM('message', 'match', 'block')`);
        await queryRunner.query(`CREATE TYPE "public"."notification_notification_status_enum" AS ENUM('unread', 'read')`);
        await queryRunner.query(`CREATE TABLE "notification" ("notification_id" SERIAL NOT NULL, "notification_type" "public"."notification_notification_type_enum" NOT NULL, "notification_content" text NOT NULL, "notification_status" "public"."notification_notification_status_enum" NOT NULL DEFAULT 'unread', "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "PK_fc4db99eb33f32cea47c5b6a39c" PRIMARY KEY ("notification_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_block_status_enum" AS ENUM('active', 'unblocked')`);
        await queryRunner.query(`CREATE TABLE "user_block" ("block_id" SERIAL NOT NULL, "blocked_at" TIMESTAMP NOT NULL DEFAULT now(), "status" "public"."user_block_status_enum" NOT NULL DEFAULT 'active', "blockerUserId" integer, "blockedUserId" integer, CONSTRAINT "PK_1b24094a1f4c9c05a1c4bc84813" PRIMARY KEY ("block_id"))`);
        await queryRunner.query(`CREATE TABLE "interest" ("interest_id" SERIAL NOT NULL, "interest_name" character varying NOT NULL, CONSTRAINT "UQ_ff3f28d0af5f75635183487179e" UNIQUE ("interest_name"), CONSTRAINT "PK_ad9c4de39cef87e602cc7f0ca7b" PRIMARY KEY ("interest_id"))`);
        await queryRunner.query(`CREATE TABLE "user_interest" ("user_interest_id" SERIAL NOT NULL, "userUserId" integer, "interestInterestId" integer, CONSTRAINT "PK_9481ed9f8b295b4b5ce1addf1c6" PRIMARY KEY ("user_interest_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_gender_enum" AS ENUM('male', 'female', 'other')`);
        await queryRunner.query(`CREATE TABLE "user" ("user_id" SERIAL NOT NULL, "email" character varying NOT NULL, "phone_number" character varying, "password" character varying NOT NULL, "full_name" character varying, "birthdate" TIMESTAMP DEFAULT now(), "gender" "public"."user_gender_enum", "location" geometry(Point,4326), "bio" text, "created_at" TIMESTAMP DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_01eea41349b6c9275aec646eee0" UNIQUE ("phone_number"), CONSTRAINT "PK_758b8ce7c18b9d347461b30228d" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "user_photo" ("photo_id" SERIAL NOT NULL, "photo_url" character varying NOT NULL, "is_profile_picture" boolean NOT NULL DEFAULT false, "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "PK_14bcefac71cdeafb52fe372e09c" PRIMARY KEY ("photo_id"))`);
        await queryRunner.query(`ALTER TABLE "match" ADD CONSTRAINT "FK_20b574ed7d6a9373faff8f89a3a" FOREIGN KEY ("user1UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match" ADD CONSTRAINT "FK_a85ee5b5351813ae60448f53b4b" FOREIGN KEY ("user2UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_a568d84869b0b1564824f355361" FOREIGN KEY ("user1UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_7aaf097429b888f9ecb544d614c" FOREIGN KEY ("user2UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_f8c996f451b3af18dc374210d71" FOREIGN KEY ("conversationConversationId") REFERENCES "conversation"("conversation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_bd31eecc47806fe4d4f27991b76" FOREIGN KEY ("senderUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_03879f1bfdb3efdf24e732d8c73" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_block" ADD CONSTRAINT "FK_2fdf581f9708cf6c2c68bfabcd9" FOREIGN KEY ("blockerUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_block" ADD CONSTRAINT "FK_f8d3ed19d5a271bb6025aedb8e7" FOREIGN KEY ("blockedUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_interest" ADD CONSTRAINT "FK_c46aabf03db5fbece97ce767461" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_interest" ADD CONSTRAINT "FK_b0c1609e31a663f260157d9f52e" FOREIGN KEY ("interestInterestId") REFERENCES "interest"("interest_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_photo" ADD CONSTRAINT "FK_438d069815e5a19bfc2245c7a8f" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_photo" DROP CONSTRAINT "FK_438d069815e5a19bfc2245c7a8f"`);
        await queryRunner.query(`ALTER TABLE "user_interest" DROP CONSTRAINT "FK_b0c1609e31a663f260157d9f52e"`);
        await queryRunner.query(`ALTER TABLE "user_interest" DROP CONSTRAINT "FK_c46aabf03db5fbece97ce767461"`);
        await queryRunner.query(`ALTER TABLE "user_block" DROP CONSTRAINT "FK_f8d3ed19d5a271bb6025aedb8e7"`);
        await queryRunner.query(`ALTER TABLE "user_block" DROP CONSTRAINT "FK_2fdf581f9708cf6c2c68bfabcd9"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_03879f1bfdb3efdf24e732d8c73"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_bd31eecc47806fe4d4f27991b76"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_f8c996f451b3af18dc374210d71"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_7aaf097429b888f9ecb544d614c"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_a568d84869b0b1564824f355361"`);
        await queryRunner.query(`ALTER TABLE "match" DROP CONSTRAINT "FK_a85ee5b5351813ae60448f53b4b"`);
        await queryRunner.query(`ALTER TABLE "match" DROP CONSTRAINT "FK_20b574ed7d6a9373faff8f89a3a"`);
        await queryRunner.query(`DROP TABLE "user_photo"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_gender_enum"`);
        await queryRunner.query(`DROP TABLE "user_interest"`);
        await queryRunner.query(`DROP TABLE "interest"`);
        await queryRunner.query(`DROP TABLE "user_block"`);
        await queryRunner.query(`DROP TYPE "public"."user_block_status_enum"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP TYPE "public"."notification_notification_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notification_notification_type_enum"`);
        await queryRunner.query(`DROP TABLE "message"`);
        await queryRunner.query(`DROP TYPE "public"."message_content_type_enum"`);
        await queryRunner.query(`DROP TABLE "conversation"`);
        await queryRunner.query(`DROP TABLE "match"`);
        await queryRunner.query(`DROP TYPE "public"."match_match_status_enum"`);
    }

}
