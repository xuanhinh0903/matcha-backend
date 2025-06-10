import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1743121405000 implements MigrationInterface {
  name = 'AddIndexes1743121405000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes for conversation user lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_user1" ON "conversation" ("user1UserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_user2" ON "conversation" ("user2UserId")`,
    );

    // Add combined index for conversation lookups by both users (helps in chat queries)
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_users" ON "conversation" ("user1UserId", "user2UserId")`,
    );

    // Add indexes for message lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_message_conversation" ON "message" ("conversationConversationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_sender" ON "message" ("senderUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_message_sent_at" ON "message" ("sent_at")`,
    );

    // Add combined index for message lookups by conversation and timestamp
    await queryRunner.query(
      `CREATE INDEX "IDX_message_conversation_sent_at" ON "message" ("conversationConversationId", "sent_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_message_conversation_sent_at"`);
    await queryRunner.query(`DROP INDEX "IDX_message_sent_at"`);
    await queryRunner.query(`DROP INDEX "IDX_message_sender"`);
    await queryRunner.query(`DROP INDEX "IDX_message_conversation"`);
    await queryRunner.query(`DROP INDEX "IDX_conversation_users"`);
    await queryRunner.query(`DROP INDEX "IDX_conversation_user2"`);
    await queryRunner.query(`DROP INDEX "IDX_conversation_user1"`);
  }
}
