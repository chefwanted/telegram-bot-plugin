import 'dotenv/config';
import { createPluginFromEnv } from './dist/index.js';

const plugin = createPluginFromEnv();

plugin.start().then(() => {
  console.log('✅ Bot started successfully!');
  console.log('📱 Send /start to your bot on Telegram');
}).catch(err => {
  console.error('❌ Failed to start bot:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping bot...');
  await plugin.stop();
  process.exit(0);
});
