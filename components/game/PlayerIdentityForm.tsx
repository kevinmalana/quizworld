"use client";

const AVATARS = [
  ['🦁', 'Lion'], ['🐯', 'Tiger'], ['🐺', 'Wolf'], ['🦊', 'Fox'],
  ['🐸', 'Frog'], ['🦄', 'Unicorn'], ['🐉', 'Dragon'], ['🦋', 'Butterfly'],
  ['🦅', 'Eagle'], ['🐬', 'Dolphin'], ['🦝', 'Raccoon'], ['🐱', 'Cat'],
] as const;

/** Presentation only: the route owns identity, credentials and transport. */
export function PlayerIdentityForm({ pin, nickname, avatar, error, joining, onNicknameChange, onAvatarChange, onSubmit }: {
  pin: string; nickname: string; avatar: string; error: string; joining: boolean;
  onNicknameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return <form className="card join-card" onSubmit={event => { event.preventDefault(); if (!joining) onSubmit(); }}>
    <p className="eyebrow">Game {pin} · Your player</p>
    <h1 className="font-display join-title">Make yourself known.</h1>
    <p className="join-subtitle">Your nickname and avatar appear in the lobby.</p>
    <label className="field-label" htmlFor="player-nickname">Nickname</label>
    <input id="player-nickname" type="text" placeholder="Nickname" value={nickname}
      onChange={event => onNicknameChange(event.target.value)} className="input-pin join-nickname-input"
      maxLength={20} autoComplete="nickname" required aria-describedby={error ? 'player-identity-error' : undefined} />
    <fieldset className="identity-avatars">
      <legend className="field-label">Pick your avatar</legend>
      <div className="join-pin-grid">{AVATARS.map(([symbol, name]) => <button key={symbol} type="button"
        onClick={() => onAvatarChange(symbol)} aria-label={name} aria-pressed={avatar === symbol}
        className={avatar === symbol ? 'nickname-avatar-btn is-selected' : 'nickname-avatar-btn'}>
        <span aria-hidden="true">{symbol}</span>
      </button>)}</div>
    </fieldset>
    {error && <div id="player-identity-error" className="error-message" role="alert">{error}</div>}
    <button type="submit" disabled={joining} className="btn btn-primary btn-lg join-submit-btn">
      {joining ? 'Joining...' : `Join as ${nickname.trim() || 'Player'} 🎮`}
    </button>
    <p className="join-footnote">No account needed. The host starts the game.</p>
  </form>;
}
