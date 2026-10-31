const path = require('node:path');
require('dotenv').config();

const root = path.resolve(__dirname, '..');
const dbProvider = process.env.DB_PROVIDER || 'sqlite';
if (!['sqlite', 'sqlserver'].includes(dbProvider)) {
  throw new Error('Configuração inválida: DB_PROVIDER deve ser "sqlite" ou "sqlserver".');
}

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Configuração inválida: PORT deve ser um número inteiro entre 1 e 65535.');
}

const sql = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  auth: process.env.AZURE_SQL_AUTH || 'sql'
};

if (dbProvider === 'sqlserver') {
  if (!['sql', 'managedIdentity'].includes(sql.auth)) {
    throw new Error('Configuração inválida: AZURE_SQL_AUTH deve ser "sql" ou "managedIdentity".');
  }
  const required = ['server', 'database'];
  if (sql.auth !== 'managedIdentity') required.push('user', 'password');
  const missing = required.filter((key) => !sql[key]);
  if (missing.length) {
    throw new Error(`Configuração SQL incompleta: ${missing.map((key) => `AZURE_SQL_${key.toUpperCase()}`).join(', ')}`);
  }
}

module.exports = {
  port,
  environment: process.env.APP_ENV || 'development',
  dbProvider,
  sqlitePath: path.resolve(root, process.env.SQLITE_PATH || './data/loja.db'),
  sql,
  aiEnabled: process.env.AI_ENABLED === 'true',
  ai: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21'
  }
};
