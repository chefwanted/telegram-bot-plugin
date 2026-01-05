/**
 * Games Feature - Trivia and simple games
 */

export interface TriviaQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    question: 'Wat is de hoofdstad van Nederland?',
    options: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht'],
    correct: 0,
  },
  {
    question: 'Hoeveel provincies heeft Nederland?',
    options: ['10', '11', '12', '13'],
    correct: 2,
  },
  {
    question: 'Wat is de hoogste berg van Nederland?',
    options: ['Vaalserberg', 'Mount Scenery', 'Drielandenpunt', 'Koningin Julianatop'],
    correct: 0,
    explanation: 'De Vaalserberg is 322,4 meter hoog.',
  },
  {
    question: 'In welk jaar werd de euro ingevoerd in Nederland?',
    options: ['1999', '2000', '2001', '2002'],
    correct: 3,
  },
  {
    question: 'Wat is de grootste stad van Nederland?',
    options: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht'],
    correct: 0,
  },
];

export interface GameState {
  type: 'trivia';
  question: TriviaQuestion;
  answered: boolean;
  score: number;
}

const activeGames = new Map<string, GameState>();

export function getRandomTrivia(): TriviaQuestion {
  return TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
}

export function startTrivia(chatId: string): GameState {
  const question = getRandomTrivia();
  const state: GameState = {
    type: 'trivia',
    question,
    answered: false,
    score: 0,
  };
  activeGames.set(chatId, state);
  return state;
}

export function getGameState(chatId: string): GameState | undefined {
  return activeGames.get(chatId);
}

export function answerTrivia(chatId: string, answer: number): { correct: boolean; explanation?: string } | null {
  const game = activeGames.get(chatId);
  if (!game || game.type !== 'trivia' || game.answered) {
    return null;
  }

  game.answered = true;
  const isCorrect = answer === game.question.correct;

  if (isCorrect) {
    game.score++;
  }

  return {
    correct: isCorrect,
    explanation: game.question.explanation,
  };
}

export function endGame(chatId: string): void {
  activeGames.delete(chatId);
}

// Tic Tac Toe
export type TicTacToeBoard = (null | 'X' | 'O')[];
export type TicTacToeState = {
  board: TicTacToeBoard;
  currentPlayer: 'X' | 'O';
  winner: null | 'X' | 'O' | 'tie';
};

const ticTacToeGames = new Map<string, TicTacToeState>();

export function startTicTacToe(chatId: string): TicTacToeState {
  const state: TicTacToeState = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    winner: null,
  };
  ticTacToeGames.set(chatId, state);
  return state;
}

export function makeMove(chatId: string, position: number): { success: boolean; winner?: TicTacToeState['winner'] } | null {
  const game = ticTacToeGames.get(chatId);
  if (!game || game.winner || position < 0 || position > 8 || game.board[position]) {
    return null;
  }

  game.board[position] = game.currentPlayer;

  // Check winner
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c]) {
      game.winner = game.board[a];
      return { success: true, winner: game.winner };
    }
  }

  if (!game.board.includes(null)) {
    game.winner = 'tie';
    return { success: true, winner: 'tie' };
  }

  game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
  return { success: true };
}

export function getTicTacToeState(chatId: string): TicTacToeState | undefined {
  return ticTacToeGames.get(chatId);
}

export function endTicTacToe(chatId: string): void {
  ticTacToeGames.delete(chatId);
}
