import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1740803416183 implements MigrationInterface {
  name = 'Migration1740803416183';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_settings_gender_preference_enum" AS ENUM('male', 'female', 'all')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_settings" ("settings_id" SERIAL NOT NULL, "distance_preference" integer NOT NULL DEFAULT '50', "gender_preference" "public"."user_settings_gender_preference_enum" NOT NULL DEFAULT 'all', "min_age_preference" integer NOT NULL DEFAULT '18', "max_age_preference" integer NOT NULL DEFAULT '100', "show_online_status" boolean NOT NULL DEFAULT true, "receive_notifications" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userUserId" integer, CONSTRAINT "REL_09286406d3fce0e440132b549f" UNIQUE ("userUserId"), CONSTRAINT "PK_6b780f1ae506a7d7bd0d45d6751" PRIMARY KEY ("settings_id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_report_reason_enum" AS ENUM('fake_profile', 'inappropriate_content', 'harassment', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."report_status_enum" AS ENUM('pending', 'reviewed', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "report" ("report_id" SERIAL NOT NULL, "report_reason" "public"."report_report_reason_enum" NOT NULL, "details" text, "status" "public"."report_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "reporterUserId" integer, "reportedUserId" integer, CONSTRAINT "PK_1bdd9ab86f1a920d365961cb28c" PRIMARY KEY ("report_id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_block" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "last_active" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD "is_online" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" ADD CONSTRAINT "FK_09286406d3fce0e440132b549fd" FOREIGN KEY ("userUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report" ADD CONSTRAINT "FK_9a845f000064671547c77cf9582" FOREIGN KEY ("reporterUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "report" ADD CONSTRAINT "FK_9bcc42f31a07ba2ec734bfa7dd0" FOREIGN KEY ("reportedUserId") REFERENCES "user"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "report" DROP CONSTRAINT "FK_9bcc42f31a07ba2ec734bfa7dd0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "report" DROP CONSTRAINT "FK_9a845f000064671547c77cf9582"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_settings" DROP CONSTRAINT "FK_09286406d3fce0e440132b549fd"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "is_online"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "last_active"`);
    await queryRunner.query(`DROP TABLE "report"`);
    await queryRunner.query(`DROP TYPE "public"."report_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."report_report_reason_enum"`);
    await queryRunner.query(`DROP TABLE "user_settings"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_settings_gender_preference_enum"`,
    );
  }
}
