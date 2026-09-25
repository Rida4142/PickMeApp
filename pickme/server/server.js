require('dotenv').config();

const { start } = require('./index');

start().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
