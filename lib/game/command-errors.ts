/** Stable transport outcomes; display copy is not an authorization decision. */
const LEGACY_REASONS: Readonly<Record<string, string>> = {
  'Session not found': 'not_found',
  'Session not found.': 'not_found',
  'Player session is invalid.': 'invalid_player_token',
  'Player session was not found.': 'unknown_player',
  'Host session is invalid.': 'invalid_host_session',
  'Only the host can perform this action.': 'not_host',
  'Your answer is already locked in.': 'already_answered',
  'Answer window has closed.': 'answer_window_closed',
  'This action is not allowed right now.': 'invalid_state',
  'Game is not accepting new players.': 'session_closed',
  'Nickname is required.': 'invalid_player',
  'That nickname is already taken in this game.': 'nickname_taken',
  'This game is full.': 'game_full',
};

const REASON_MESSAGES: Readonly<Record<string, string>> = {
  timeout: 'The command outcome is not confirmed. Checking game state.',
  unavailable: 'The command outcome is not confirmed. Checking game state.',
  invalid_player_token: 'Player session is invalid.',
  unknown_player: 'Player session was not found.',
  already_answered: 'Your answer is already locked in.',
  answer_window_closed: 'Answer window has closed.',
  not_host: 'Only the host can perform this action.',
  invalid_state: 'This action is not allowed right now.',
  bad_answer: 'Answer does not belong to the current question.',
  eliminated: 'You have been eliminated from this game.',
};

type ErrorBody = { reason?: unknown; error?: unknown; message?: unknown; code?: unknown };

export function gameErrorReason(error: unknown): string | null {
  if (error && typeof error === 'object') {
    const body = error as ErrorBody;
    // The authoritative reason wins, even when old human copy happens to
    // match a different outcome. Never discard credentials on that copy.
    if (typeof body.reason === 'string' && body.reason.length) return body.reason;
    if (body.code === '23505') return 'already_answered';
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return LEGACY_REASONS[message] ?? null;
}

export function hasGameErrorReason(error: unknown, ...reasons: string[]): boolean {
  const reason = gameErrorReason(error);
  return reason !== null && reasons.includes(reason);
}

/** Normalize HTTP and channel reply bodies without attaching credentials/payloads. */
export function gameCommandError(body: unknown, fallback = 'Game command failed.'): Error & { reason?: string } {
  const value = body && typeof body === 'object' ? body as ErrorBody : {};
  const reason = typeof value.reason === 'string' ? value.reason : undefined;
  const supplied = typeof value.message === 'string' ? value.message : typeof value.error === 'string' ? value.error : undefined;
  const message = supplied || (reason ? REASON_MESSAGES[reason] : undefined) || fallback;
  return Object.assign(new Error(message), { reason: reason || gameErrorReason(message) || undefined });
}
