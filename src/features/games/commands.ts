/**
 * Games Commands
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import {
  startTrivia,
  getGameState,
  answerTrivia,
  endGame,
  startTicTacToe,
  getTicTacToeState,
  makeMove,
  endTicTacToe,
} from './games';

// Trivia
export async function triviaCommand(api: ApiMethods, message: Message): Promise<void> {
  const game = startTrivia(String(message.chat.id));
  const q = game.question;

  let text = `🎮 Trivia!\n\n${q.question}\n\n`;
  q.options.forEach((opt, i) => {
    text += `${i + 1}. ${opt}\n`;
  });
  text += `\nGebruik /trivia_answer <nummer> om te antwoorden.`;

  await api.sendMessage({ chat_id: message.chat.id, text });
}

export async function triviaAnswerCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const answer = parseInt(args[0] || '0', 10) - 1;
  const result = answerTrivia(String(message.chat.id), answer);

  if (!result) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Geen actief spel of ongeldig antwoord.\nGebruik /trivia om een nieuw spel te starten.',
    });
    return;
  }

  if (result.correct) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `✅ Correct!\n\n${result.explanation || ''}\n\nGebruik /trivia voor de volgende vraag.`,
    });
  } else {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: `❌ Fout!\n\n${result.explanation || ''}`,
    });
  }

  endGame(String(message.chat.id));
}

// Tic Tac Toe
export async function tttCommand(api: ApiMethods, message: Message): Promise<void> {
  startTicTacToe(String(message.chat.id));

  const keyboard = {
    inline_keyboard: [
      [
        { text: '1', callback_data: 'ttt_0' },
        { text: '2', callback_data: 'ttt_1' },
        { text: '3', callback_data: 'ttt_2' },
      ],
      [
        { text: '4', callback_data: 'ttt_3' },
        { text: '5', callback_data: 'ttt_4' },
        { text: '6', callback_data: 'ttt_5' },
      ],
      [
        { text: '7', callback_data: 'ttt_7' },
        { text: '8', callback_data: 'ttt_8' },
        { text: '9', callback_data: 'ttt_9' },
      ],
    ],
  };

  await api.sendMessage({
    chat_id: message.chat.id,
    text: `🎮 Tic Tac Toe!\n\nJij bent X. Kies een positie (1-9).`,
    reply_markup: keyboard,
  });
}

export async function tttMoveCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const position = parseInt(args[0] || '0', 10) - 1;
  const result = makeMove(String(message.chat.id), position);

  if (!result) {
    await api.sendMessage({
      chat_id: message.chat.id,
      text: '❕ Ongilde zet.\nGebruik /ttt om een nieuw spel te starten.',
    });
    return;
  }

  const game = getTicTacToeState(String(message.chat.id));
  if (!game) return;

  // Display board
  const display = game.board.map((cell, i) => cell || (i + 1).toString());
  let text = `🎮 Tic Tac Toe\n\n`;
  text += `${display[0]} | ${display[1]} | ${display[2]}\n`;
  text += `---------\n`;
  text += `${display[3]} | ${display[4]} | ${display[5]}\n`;
  text += `---------\n`;
  text += `${display[6]} | ${display[7]} | ${display[8]}\n\n`;

  if (result.winner) {
    if (result.winner === 'tie') {
      text += '🤝 Gelijkspel!';
    } else {
      text += `🏆 ${result.winner} wint!`;
    }
    endTicTacToe(String(message.chat.id));
  } else {
    text += `Huidige speler: ${game.currentPlayer}\nGebruik /ttt_move <positie>`;
  }

  await api.sendMessage({ chat_id: message.chat.id, text });
}
