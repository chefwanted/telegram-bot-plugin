import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export interface VersionInfo {
  packageVersion: string;
  pluginVersion: string;
  lastUpdated: string;
  gitCommit?: string;
  gitBranch?: string;
  nodeVersion: string;
  highlights: string[];
  features: string[];
}

let cachedInfo: VersionInfo | null = null;

function getGitInfo(): { commit?: string; branch?: string } {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    return { commit, branch };
  } catch {
    return {};
  }
}

export function getVersionInfo(): VersionInfo {
  if (cachedInfo) return cachedInfo;

  const pkgPath = join(__dirname, '..', '..', 'package.json');
  let packageVersion = 'unknown';

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
    packageVersion = pkg.version || packageVersion;
  } catch {
    // ignore read errors
  }

  const gitInfo = getGitInfo();

  cachedInfo = {
    packageVersion,
    pluginVersion: '2.2.0',
    lastUpdated: '2026-01-05',
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
    nodeVersion: process.version,
    highlights: [
      '🔥 Multi-LLM Fallback: Claude CLI → Z.ai → MiniMax v2.1 → Lite',
      '⚡ Improved Claude CLI timeout handling (5min)',
      '🆕 MiniMax v2.1 integratie met auto Lite fallback',
      '🐛 Bugfixes: TypeScript build errors opgelost',
      '🔧 Enhanced error handling en logging',
    ],
    features: [
      '💬 Multi-LLM AI Chat (Claude/Z.ai/MiniMax)',
      '🔄 Auto fallback bij LLM failures',
      '💻 Code Assistant met patches',
      '📂 Project & File Management',
      '📝 Notities & Herinneringen',
      '🌐 Vertaling (12 talen)',
      '🎮 Games (Trivia, TicTacToe)',
      '👥 Groepen & Communities',
      '📰 Nieuws & P2000',
      '📊 Analytics & Stats',
    ],
  };

  return cachedInfo;
}

export function formatVersionMessage(): string {
  const info = getVersionInfo();
  
  const lines = [
    '📦 Versie Informatie',
    '',
    `Plugin: v${info.pluginVersion}`,
    `Package: v${info.packageVersion}`,
    `Node: ${info.nodeVersion}`,
  ];

  if (info.gitCommit) {
    lines.push(`Git: ${info.gitBranch}@${info.gitCommit}`);
  }

  lines.push(`Laatst bijgewerkt: ${info.lastUpdated}`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('📋 Features:');
  for (const feature of info.features) {
    lines.push(`  ${feature}`);
  }

  return lines.join('\n');
}

export function formatUpdateMessage(): string {
  const info = getVersionInfo();
  
  const lines = [
    `🆕 Updates v${info.pluginVersion}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🔥 Nieuw in deze versie:',
    '',
  ];

  for (const highlight of info.highlights) {
    lines.push(`  ${highlight}`);
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('💡 Quick Start Developer Mode:');
  lines.push('');
  lines.push('1. /project open /pad/naar/project');
  lines.push('2. /files - bekijk bestanden');
  lines.push('3. /focus add src/index.ts');
  lines.push('4. /code voeg feature X toe');
  lines.push('5. /patch apply <id>');
  lines.push('');
  lines.push('Gebruik /dev voor complete developer help.');

  return lines.join('\n');
}

export function formatChangelogMessage(): string {
  const changelog = [
    '📜 Changelog',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🏷️ v2.2.0 (2026-01-05) - LATEST',
    '  • Multi-LLM fallback systeem',
    '  • MiniMax v2.1 + Lite integratie',
    '  • Claude CLI timeout verbeterd',
    '  • TypeScript build fixes',
    '  • Enhanced error messages',
    '',
    '🏷️ v2.1.0 (2026-01-05)',
    '  • Developer Mode toegevoegd',
    '  • Project context & file browsing',
    '  • Focus system voor AI context',
    '  • Patch management systeem',
    '',
    '🏷️ v2.0.0 (2026-01-04)',
    '  • Initial release met Claude/GLM-4.7',
    '  • 28+ bot features',
    '  • Notities, herinneringen, vertaling',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ];

  return changelog.join('\n');
}
