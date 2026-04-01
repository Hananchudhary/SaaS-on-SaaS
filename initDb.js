const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

require('dotenv').config({ path: path.resolve(__dirname, './backend/config.env') });

const ROOT_DIR = path.resolve(__dirname, '.', '.');
const SCHEMA_PATH = path.resolve(ROOT_DIR, 'database', 'schema.sql');
const CONFIG_PATH = path.resolve(ROOT_DIR, 'config.json');

const DEFAULT_SYSTEM_CLIENT = {
  client_id: 1,
  company_name: 'SYSTEM',
  email: 'system@saasplatform.com',
  phone: '+1-800-SYSTEM',
  address: 'System Records',
  status: 'Active'
};

async function main() {
  const rootPasswordArg = process.argv[2];
  const rootSocket = process.env.DB_ROOT_SOCKET;
  const rootPassword = rootPasswordArg ?? rootPasswordEnv;
  if (!rootPassword && !rootSocket) {
    throw new Error(
      'Missing root password. Use: node initDb.js <root_password> or set DB_ROOT_PASSWORD. ' +
      'If your MySQL root uses socket auth, set DB_ROOT_SOCKET.'
    );
  }

  const schemaSql = await fs.readFile(SCHEMA_PATH, 'utf8');
  const rawConfig = await fs.readFile(CONFIG_PATH, 'utf8');
  const config = JSON.parse(rawConfig);
  let cleanedSchema = schemaSql
  .replace(/DELIMITER \$\$/g, '')
  .replace(/DELIMITER ;/g, '')
  .replace(/\$\$/g, ';');

  if (!config.system_user) {
    throw new Error('config.json is missing "system_user"');
  }
  if (!Array.isArray(config.plans) || config.plans.length === 0) {
    throw new Error('config.json is missing "plans" array');
  }

  const rootUser = 'root';
  const rootHost = process.env.DB_HOST || 'localhost';
  const rootConnection = await mysql.createConnection({
    host: rootHost,
    user: rootUser,
    password: rootPassword,
    socketPath: rootSocket,
    multipleStatements: true
  });
  
  const dbName = process.env.DB_NAME;
  const appUser = process.env.DB_USER;
  const appPassword = process.env.DB_PASSWORD;
  const userLiteral = rootConnection.escape(appUser);
  const passwordLiteral = rootConnection.escape(appPassword);
  const appHost = process.env.DB_USER_HOST || process.env.DB_HOST || 'localhost';
  const appHostLiteral = rootConnection.escape(appHost);
  await rootConnection.query(`CREATE USER IF NOT EXISTS ${userLiteral}@${appHostLiteral} IDENTIFIED BY ${passwordLiteral}`);
  await rootConnection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ${userLiteral}@${appHostLiteral}`);
  await rootConnection.query('FLUSH PRIVILEGES');
  await rootConnection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await rootConnection.query(`CREATE DATABASE \`${dbName}\``);
  await rootConnection.query(`USE \`${dbName}\``);


  try {
    await rootConnection.query(cleanedSchema);

    const systemClient = DEFAULT_SYSTEM_CLIENT;
    const [existingClient] = await rootConnection.query(
      'SELECT client_id FROM Client WHERE client_id = ?',
      [systemClient.client_id]
    );

    if (existingClient.length === 0) {
      await rootConnection.query(
        'INSERT INTO Client (client_id, company_name, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?)',
        [
          1, 
          'SYSTEM', 
          'system@saasplatform.com', 
          '+1-800-SYSTEM', 
          'System Records', 
          'Active'
        ]
      );
    }

    const u = config.system_user;
    const hashedPassword = await bcrypt.hash(u.password, SALT_ROUNDS);
    
    if (!hashedPassword) {
      throw new Error('system_user must include password_hash or password');
    }
  
    await rootConnection.query(
      'INSERT INTO User (user_id, client_id, username, email, password_hash, tier_level, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        u.user_id ?? 1,
        u.client_id ?? 1,
        u.username,
        u.email,
        hashedPassword,
        u.tier_level ?? 1,
        u.status ?? 'Active',
        u.created_by ?? null
      ]
    );

    for (const plan of config.plans) {
      await rootConnection.query(
        'INSERT INTO Plan (client_id, plan_name, tier_1_users, tier_2_users, tier_3_users, monthly_price, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          plan.client_id ?? 1,
          plan.plan_name,
          plan.tier_1_users,
          plan.tier_2_users,
          plan.tier_3_users,
          plan.monthly_price,
          plan.description
        ]
      );
    }

    console.log('Schema applied and config data inserted successfully.');
  } finally {
    await rootConnection.end();
  }
}

main().catch((error) => {
  console.error('Initialization failed:', error.message);
  process.exit(1);
});
