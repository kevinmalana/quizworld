type HostPlayOptionProps = {
  enabled: boolean;
  name: string;
  avatar: string;
  fallbackName: string;
  onEnabledChange: (enabled: boolean) => void;
  onNameChange: (name: string) => void;
  onAvatarChange: (avatar: string) => void;
};

export function HostPlayOption({
  enabled,
  name,
  avatar,
  fallbackName,
  onEnabledChange,
  onNameChange,
  onAvatarChange,
}: HostPlayOptionProps) {
  return (
    <div className="card host-play-option">
      <label className="host-play-option__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={event => onEnabledChange(event.target.checked)}
        />
        <span>
          <strong>Play in this game</strong>
          <small>Answer alongside everyone else while keeping your host controls.</small>
        </span>
      </label>
      {enabled && (
        <div className="host-play-option__fields">
          <label>
            Your player name
            <input
              value={name}
              onChange={event => onNameChange(event.target.value)}
              placeholder={fallbackName}
              maxLength={20}
            />
          </label>
          <label>
            Avatar
            <input
              value={avatar}
              onChange={event => onAvatarChange(event.target.value)}
              maxLength={8}
              aria-label="Your player avatar"
            />
          </label>
        </div>
      )}
    </div>
  );
}
