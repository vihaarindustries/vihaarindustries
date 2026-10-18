/** Core accounting invariant. Invoke on the server before a journal is posted. */
export type JournalLine = { accountId: string; debitMinor: number; creditMinor: number; memo?: string };
export function validateJournal(lines: JournalLine[]) {
  if (lines.length < 2) throw new Error('A journal requires at least two lines.');
  for (const line of lines) {
    if (!line.accountId) throw new Error('Every line must reference an account.');
    if (!Number.isSafeInteger(line.debitMinor) || !Number.isSafeInteger(line.creditMinor) || line.debitMinor < 0 || line.creditMinor < 0) throw new Error('Amounts must be non-negative integer minor currency units.');
    if (line.debitMinor > 0 && line.creditMinor > 0) throw new Error('A journal line cannot have both debit and credit amounts.');
  }
  const debits=lines.reduce((sum,l)=>sum+l.debitMinor,0); const credits=lines.reduce((sum,l)=>sum+l.creditMinor,0);
  if (debits <= 0 || debits !== credits) throw new Error('Journal is not balanced.');
  return {debitsMinor:debits,creditsMinor:credits};
}
