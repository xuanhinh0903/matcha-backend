import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1745424237962 implements MigrationInterface {
    name = 'Migration1745424237962'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "report_image" ("image_id" SERIAL NOT NULL, "original_url" character varying NOT NULL, "thumbnail_url" character varying NOT NULL, "public_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "reportReportId" integer, CONSTRAINT "PK_0e1467134c9aa56a7546e07330b" PRIMARY KEY ("image_id"))`);
        await queryRunner.query(`ALTER TABLE "report_image" ADD CONSTRAINT "FK_0c040ae82d8b4c69ce9399d3546" FOREIGN KEY ("reportReportId") REFERENCES "report"("report_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_image" DROP CONSTRAINT "FK_0c040ae82d8b4c69ce9399d3546"`);
        await queryRunner.query(`DROP TABLE "report_image"`);
    }

}
