require('dotenv').config();

module.exports = {
  host: process.env.TCP_HOST || 'localhost',
  port: parseInt(process.env.TCP_PORT) || 8888,
  timeout: 60000, // 60 seconds
  encoding: 'utf-8'
};
