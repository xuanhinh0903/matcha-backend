import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1746589272541 implements MigrationInterface {
  name = 'Migration1746589272541';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_conversation_user1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_conversation_user2"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_conversation_users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_message_conversation"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_message_sender"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_message_sent_at"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_message_conversation_sent_at"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a568d84869b0b1564824f35536" ON "conversation" ("user1UserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7aaf097429b888f9ecb544d614" ON "conversation" ("user2UserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f8c996f451b3af18dc374210d7" ON "message" ("conversationConversationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c607895d31385d345659cd8bd3" ON "message" ("content") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c607895d31385d345659cd8bd3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8c996f451b3af18dc374210d7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7aaf097429b888f9ecb544d614"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a568d84869b0b1564824f35536"`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_message_conversation_sent_at" ON "message" ("conversationConversationId", "sent_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_sent_at" ON "message" ("sent_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_sender" ON "message" ("senderUserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_conversation" ON "message" ("conversationConversationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_users" ON "conversation" ("user1UserId", "user2UserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_user2" ON "conversation" ("user2UserId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_user1" ON "conversation" ("user1UserId") `,
    );
  }
}
