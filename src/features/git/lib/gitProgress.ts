export function parseGitProgressPercent(line: string): number | null {
  const match = line.match(/(\d+)%/);
  if (match) return Number(match[1]);

  const ratio = line.match(/\((\d+)\/(\d+)\)/);
  if (ratio) {
    const current = Number(ratio[1]);
    const total = Number(ratio[2]);
    if (total > 0) return Math.round((current / total) * 100);
  }

  return null;
}
