import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1746636593847 implements MigrationInterface {
    name = 'Migration1746636593847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_402bc1c95c30e2798cd2025c8c" ON "user_photo" ("is_profile_picture") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_758b8ce7c18b9d347461b30228" ON "user" ("user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_758b8ce7c18b9d347461b30228"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_402bc1c95c30e2798cd2025c8c"`);
    }

}
