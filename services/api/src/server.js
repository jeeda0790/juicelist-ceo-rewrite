const dotenv = require('dotenv');
dotenv.config();

const { createApp } = require('./app');

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION — server would have crashed silently:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — server would have crashed silently:', reason);
});

const app = createApp();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`JuiceList API running on http://localhost:${PORT}`);
});