import * as fs from 'fs';
import * as path from 'path';

const QUEUE_PATH = '/tmp/claude-telegram-bridge/messages.jsonl';
const SESSION_PATH = '/tmp/claude-telegram-bridge/session.json';

// Commands
const command = process.argv[2];

async function main() {
  switch (command) {
    case 'pending':
      showPending();
      break;
    case 'respond':
      respond(process.argv[3], process.argv.slice(4).join(' '));
      break;
    case 'stats':
      showStats();
      break;
    case 'clear':
      clearQueue();
      break;
    case 'watch':
      watchMode();
      break;
    default:
      showHelp();
  }
}

function showPending() {
  const messages = loadMessages().filter(m => m.from === 'telegram' && !m.processed);

  if (messages.length === 0) {
    console.log('✅ Geen berichten in wachtrij');
    return;
  }

  console.log('📨 ' + messages.length + ' bericht(en) in wachtrij:\n');

  messages.forEach((m, i) => {
    console.log('[' + (i + 1) + '] ID: ' + m.id);
    console.log('    Van: ' + m.userId + ' (Chat: ' + m.chatId + ')');
    console.log('    Tijd: ' + new Date(m.timestamp).toLocaleString('nl-NL'));
    console.log('    Bericht: ' + m.content + '\n');
  });
}

function respond(messageId, response) {
  if (!messageId || !response) {
    console.error('❌ Gebruik: claude-bridge.js respond <message-id> <response>');
    process.exit(1);
  }

  const messages = loadMessages();
  const message = messages.find(m => m.id === messageId);

  if (!message) {
    console.error('❌ Bericht niet gevonden: ' + messageId);
    process.exit(1);
  }

  message.response = response;
  message.from = 'claude';
  message.processed = false;

  saveMessages(messages);
  console.log('✅ Antwoord queued voor bericht ' + messageId);
}

function showStats() {
  const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
  const messages = loadMessages();
  const pending = messages.filter(m => m.from === 'telegram' && !m.processed).length;

  console.log('\n📊 Bridge Stats:');
  console.log('   Session ID: ' + session.id);
  console.log('   Actief: ' + (session.active ? '✅' : '❌'));
  console.log('   Berichten: ' + session.messageCount);
  console.log('   In wachtrij: ' + pending);
  console.log('   Laatste activiteit: ' + new Date(session.lastActivity).toLocaleString('nl-NL') + '\n');
}

function clearQueue() {
  if (fs.existsSync(QUEUE_PATH)) {
    fs.unlinkSync(QUEUE_PATH);
  }
  console.log('✅ Queue geleegd');
}

function showHelp() {
  console.log(`
🤖 Claude Bridge CLI

Gebruik:
  node claude-bridge.js pending      - Toon wachtende berichten
  node claude-bridge.js respond <id> <bericht> - Beantwoord bericht
  node claude-bridge.js stats        - Toon statistieken
  node claude-bridge.js clear        - Maak queue leeg
  node claude-bridge.js watch        - Watch mode (interactive)

Voorbeelden:
  node claude-bridge.js pending
  node claude-bridge.js respond msg-123 "Hallo! Dit is mijn antwoord."
  `);
}

function watchMode() {
  console.log('👀 Watch mode gestart (Ctrl+C om te stoppen)\n');

  let lastCount = 0;

  const interval = setInterval(() => {
    const messages = loadMessages();
    const pending = messages.filter(m => m.from === 'telegram' && !m.processed);

    if (pending.length !== lastCount) {
      if (pending.length > 0) {
        console.log('\n📨 ' + pending.length + ' nieuw bericht(en):\n');
        pending.forEach((m) => {
          const preview = m.content.length > 50 ? m.content.substring(0, 50) + '...' : m.content;
          console.log('  [' + m.id + '] ' + preview);
        });
        console.log('');
      }
      lastCount = pending.length;
    }
  }, 1000);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n👋 Watch mode gestopt');
    process.exit(0);
  });
}

function loadMessages() {
  if (!fs.existsSync(QUEUE_PATH)) {
    return [];
  }

  const content = fs.readFileSync(QUEUE_PATH, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function saveMessages(messages) {
  const content = messages.map(m => JSON.stringify(m)).join('\n') + '\n';
  fs.writeFileSync(QUEUE_PATH, content);
}

main();
