import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

const isProduction = process.env.NODE_ENV === 'production';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: isProduction ? process.env.DATABASE_URL : undefined,
  host: isProduction ? undefined : process.env.POSTGRES_HOST,
  port: isProduction ? undefined : parseInt(process.env.POSTGRES_PORT, 10),
  username: isProduction ? undefined : process.env.POSTGRES_USER,
  password: isProduction ? undefined : process.env.POSTGRES_PASSWORD,
  database: isProduction ? undefined : process.env.POSTGRES_DB,
  synchronize: false,
  entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'], // Ensure correct entity paths
  migrations: ['dist/src/database/migrations/**/*{.ts,.js}'],
  migrationsRun: false,
  logging: true,
  installExtensions: true,
});

AppDataSource.initialize()
  .then(async () => {
    console.log('Connection initialized with database...');
  })
  .catch((error) => console.log(error));

export default AppDataSource;
