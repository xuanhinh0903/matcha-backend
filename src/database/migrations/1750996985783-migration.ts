import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1750996985783 implements MigrationInterface {
    name = 'Migration1750996985783'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "device_token" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "platform" character varying NOT NULL, "lastUsed" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "PK_592ce89b9ea1a268d6140f60422" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "match" ("match_id" SERIAL NOT NULL, "match_status" "public"."match_match_status_enum" NOT NULL DEFAULT 'pending', "liked_at" TIMESTAMP, "matched_at" TIMESTAMP NOT NULL DEFAULT now(), "user1UserId" integer, "user2UserId" integer, CONSTRAINT "PK_2e7d516f3dc97d9e2f882212d2b" PRIMARY KEY ("match_id"))`);
        await queryRunner.query(`CREATE TABLE "conversation" ("conversation_id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user1UserId" integer, "user2UserId" integer, CONSTRAINT "PK_66e2b75e2704e382f3a4f2a5466" PRIMARY KEY ("conversation_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_CONV_USER1" ON "conversation" ("user1UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONV_USER2" ON "conversation" ("user2UserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONV_CREATED_AT" ON "conversation" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_CONVERSATION_USERS" ON "conversation" ("user1UserId", "user2UserId") `);
        await queryRunner.query(`CREATE TABLE "message" ("message_id" SERIAL NOT NULL, "content_type" "public"."message_content_type_enum" NOT NULL, "content" text NOT NULL, "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "read_at" TIMESTAMP, "type" character varying, "callStatus" character varying, "callType" character varying(20), "duration" integer, "conversationConversationId" integer, "senderUserId" integer, CONSTRAINT "PK_06a563cdbd963a9f7cbcb25c447" PRIMARY KEY ("message_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f8c996f451b3af18dc374210d7" ON "message" ("conversationConversationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c607895d31385d345659cd8bd3" ON "message" ("content") `);
        await queryRunner.query(`CREATE TABLE "user_block" ("block_id" SERIAL NOT NULL, "blocked_at" TIMESTAMP NOT NULL DEFAULT now(), "blockerUserId" integer, "blockedUserId" integer, CONSTRAINT "PK_1b24094a1f4c9c05a1c4bc84813" PRIMARY KEY ("block_id"))`);
        await queryRunner.query(`CREATE TABLE "interest" ("interest_id" SERIAL NOT NULL, "interest_name" character varying NOT NULL, CONSTRAINT "UQ_ff3f28d0af5f75635183487179e" UNIQUE ("interest_name"), CONSTRAINT "PK_ad9c4de39cef87e602cc7f0ca7b" PRIMARY KEY ("interest_id"))`);
        await queryRunner.query(`CREATE TABLE "user_interest" ("user_interest_id" SERIAL NOT NULL, "userUserId" integer, "interestInterestId" integer, CONSTRAINT "PK_9481ed9f8b295b4b5ce1addf1c6" PRIMARY KEY ("user_interest_id"))`);
        await queryRunner.query(`CREATE TABLE "user_photo" ("photo_id" SERIAL NOT NULL, "photo_url" character varying, "public_id" character varying, "photo_url_thumbnail" character varying, "is_profile_picture" boolean, "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "PK_14bcefac71cdeafb52fe372e09c" PRIMARY KEY ("photo_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_402bc1c95c30e2798cd2025c8c" ON "user_photo" ("is_profile_picture") `);
        await queryRunner.query(`CREATE TABLE "user_settings" ("settings_id" SERIAL NOT NULL, "privacy_photos" "public"."user_settings_privacy_photos_enum" NOT NULL DEFAULT 'public', "privacy_bio" "public"."user_settings_privacy_bio_enum" NOT NULL DEFAULT 'public', "privacy_age" "public"."user_settings_privacy_age_enum" NOT NULL DEFAULT 'matches', "privacy_interests" "public"."user_settings_privacy_interests_enum" NOT NULL DEFAULT 'public', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "REL_09286406d3fce0e440132b549f" UNIQUE ("userUserId"), CONSTRAINT "PK_6b780f1ae506a7d7bd0d45d6751" PRIMARY KEY ("settings_id"))`);
        await queryRunner.query(`CREATE TABLE "user" ("user_id" SERIAL NOT NULL, "email" character varying NOT NULL, "phone_number" character varying, "password" character varying, "firebase_uid" character varying, "full_name" character varying, "birthdate" TIMESTAMP DEFAULT now(), "gender" "public"."user_gender_enum", "role" "public"."user_role_enum" NOT NULL DEFAULT 'user', "location" geometry(Point,4326), "bio" text, "last_active" TIMESTAMP, "is_online" boolean NOT NULL DEFAULT false, "is_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), "is_banned" boolean NOT NULL DEFAULT false, "ban_reason" text, "banned_at" TIMESTAMP, "ban_expires_at" TIMESTAMP, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_01eea41349b6c9275aec646eee0" UNIQUE ("phone_number"), CONSTRAINT "UQ_40fe3048b17f675b652c1999270" UNIQUE ("firebase_uid"), CONSTRAINT "PK_758b8ce7c18b9d347461b30228d" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_758b8ce7c18b9d347461b30228" ON "user" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "notification" ("notification_id" SERIAL NOT NULL, "notification_type" "public"."notification_notification_type_enum" NOT NULL, "notification_content" text NOT NULL, "notification_status" "public"."notification_notification_status_enum" NOT NULL DEFAULT 'unread', "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "PK_fc4db99eb33f32cea47c5b6a39c" PRIMARY KEY ("notification_id"))`);
        await queryRunner.query(`CREATE TABLE "report" ("report_id" SERIAL NOT NULL, "report_reason" "public"."report_report_reason_enum" NOT NULL, "details" text, "status" "public"."report_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "reporterUserId" integer, "reportedUserId" integer, CONSTRAINT "PK_1bdd9ab86f1a920d365961cb28c" PRIMARY KEY ("report_id"))`);
        await queryRunner.query(`CREATE TABLE "report_image" ("image_id" SERIAL NOT NULL, "original_url" character varying NOT NULL, "thumbnail_url" character varying NOT NULL, "public_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "reportReportId" integer, CONSTRAINT "PK_0e1467134c9aa56a7546e07330b" PRIMARY KEY ("image_id"))`);
        await queryRunner.query(`ALTER TABLE "device_token" ADD CONSTRAINT "FK_27b5b157cb9fb5fc50aa2a0f661" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match" ADD CONSTRAINT "FK_20b574ed7d6a9373faff8f89a3a" FOREIGN KEY ("user1UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match" ADD CONSTRAINT "FK_a85ee5b5351813ae60448f53b4b" FOREIGN KEY ("user2UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_a568d84869b0b1564824f355361" FOREIGN KEY ("user1UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation" ADD CONSTRAINT "FK_7aaf097429b888f9ecb544d614c" FOREIGN KEY ("user2UserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_f8c996f451b3af18dc374210d71" FOREIGN KEY ("conversationConversationId") REFERENCES "conversation"("conversation_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message" ADD CONSTRAINT "FK_bd31eecc47806fe4d4f27991b76" FOREIGN KEY ("senderUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_block" ADD CONSTRAINT "FK_2fdf581f9708cf6c2c68bfabcd9" FOREIGN KEY ("blockerUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_block" ADD CONSTRAINT "FK_f8d3ed19d5a271bb6025aedb8e7" FOREIGN KEY ("blockedUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_interest" ADD CONSTRAINT "FK_c46aabf03db5fbece97ce767461" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_interest" ADD CONSTRAINT "FK_b0c1609e31a663f260157d9f52e" FOREIGN KEY ("interestInterestId") REFERENCES "interest"("interest_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_photo" ADD CONSTRAINT "FK_438d069815e5a19bfc2245c7a8f" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD CONSTRAINT "FK_09286406d3fce0e440132b549fd" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_03879f1bfdb3efdf24e732d8c73" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_9a845f000064671547c77cf9582" FOREIGN KEY ("reporterUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report" ADD CONSTRAINT "FK_9bcc42f31a07ba2ec734bfa7dd0" FOREIGN KEY ("reportedUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_image" ADD CONSTRAINT "FK_0c040ae82d8b4c69ce9399d3546" FOREIGN KEY ("reportReportId") REFERENCES "report"("report_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_image" DROP CONSTRAINT "FK_0c040ae82d8b4c69ce9399d3546"`);
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_9bcc42f31a07ba2ec734bfa7dd0"`);
        await queryRunner.query(`ALTER TABLE "report" DROP CONSTRAINT "FK_9a845f000064671547c77cf9582"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_03879f1bfdb3efdf24e732d8c73"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP CONSTRAINT "FK_09286406d3fce0e440132b549fd"`);
        await queryRunner.query(`ALTER TABLE "user_photo" DROP CONSTRAINT "FK_438d069815e5a19bfc2245c7a8f"`);
        await queryRunner.query(`ALTER TABLE "user_interest" DROP CONSTRAINT "FK_b0c1609e31a663f260157d9f52e"`);
        await queryRunner.query(`ALTER TABLE "user_interest" DROP CONSTRAINT "FK_c46aabf03db5fbece97ce767461"`);
        await queryRunner.query(`ALTER TABLE "user_block" DROP CONSTRAINT "FK_f8d3ed19d5a271bb6025aedb8e7"`);
        await queryRunner.query(`ALTER TABLE "user_block" DROP CONSTRAINT "FK_2fdf581f9708cf6c2c68bfabcd9"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_bd31eecc47806fe4d4f27991b76"`);
        await queryRunner.query(`ALTER TABLE "message" DROP CONSTRAINT "FK_f8c996f451b3af18dc374210d71"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_7aaf097429b888f9ecb544d614c"`);
        await queryRunner.query(`ALTER TABLE "conversation" DROP CONSTRAINT "FK_a568d84869b0b1564824f355361"`);
        await queryRunner.query(`ALTER TABLE "match" DROP CONSTRAINT "FK_a85ee5b5351813ae60448f53b4b"`);
        await queryRunner.query(`ALTER TABLE "match" DROP CONSTRAINT "FK_20b574ed7d6a9373faff8f89a3a"`);
        await queryRunner.query(`ALTER TABLE "device_token" DROP CONSTRAINT "FK_27b5b157cb9fb5fc50aa2a0f661"`);
        await queryRunner.query(`DROP TABLE "report_image"`);
        await queryRunner.query(`DROP TABLE "report"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_758b8ce7c18b9d347461b30228"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TABLE "user_settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_402bc1c95c30e2798cd2025c8c"`);
        await queryRunner.query(`DROP TABLE "user_photo"`);
        await queryRunner.query(`DROP TABLE "user_interest"`);
        await queryRunner.query(`DROP TABLE "interest"`);
        await queryRunner.query(`DROP TABLE "user_block"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c607895d31385d345659cd8bd3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8c996f451b3af18dc374210d7"`);
        await queryRunner.query(`DROP TABLE "message"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONVERSATION_USERS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONV_CREATED_AT"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONV_USER2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CONV_USER1"`);
        await queryRunner.query(`DROP TABLE "conversation"`);
        await queryRunner.query(`DROP TABLE "match"`);
        await queryRunner.query(`DROP TABLE "device_token"`);
    }

}
