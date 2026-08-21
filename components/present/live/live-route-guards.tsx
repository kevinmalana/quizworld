type PresentationLiveGuardProps = {
  state: "loading" | "unavailable" | "ended" | "presenter-token" | "participant-session" | "empty";
  message?: string;
  title?: string;
  isHost?: boolean;
  onNavigate?: (path: string) => void;
  presentationId?: string;
  joinCode?: string | null;
};

export function PresentationLiveGuard({
  state,
  message,
  title,
  isHost = false,
  onNavigate = () => undefined,
  presentationId,
  joinCode,
}: PresentationLiveGuardProps) {
  if (state === "loading" || state === "empty") {
    return <div className="container present-live-guard">{state === "loading" ? "Loading..." : "No slides"}</div>;
  }

  const content = {
    unavailable: {
      icon: "",
      heading: "Presentation unavailable",
      copy: message || "Presentation could not be loaded.",
      button: "Enter another code",
      path: "/present/join",
    },
    ended: {
      icon: "🎉",
      heading: "Thanks for taking part",
      copy: `${title || "This presentation"} has ended.`,
      button: isHost ? "Back to presentations" : "Back to QuizWorld",
      path: isHost ? "/present" : "/",
    },
    "presenter-token": {
      icon: "🎤",
      heading: "Start from the editor",
      copy: "Presenter controls require a live presenter token. Start this deck from the editor.",
      button: "Open Editor",
      path: `/present/${presentationId}/edit`,
    },
    "participant-session": {
      icon: "🙋",
      heading: "Join through the presentation code",
      copy: "Audience responses need a participant session so your answers and upvotes are valid.",
      button: "Join Presentation",
      path: joinCode ? `/present/join?code=${joinCode}` : "/present/join",
    },
  }[state];

  return (
    <div className="container present-live-guard present-live-guard--narrow">
      <div className="card present-live-guard-card">
        {content.icon && <div className="present-live-guard-icon">{content.icon}</div>}
        <h1 className="font-display present-live-guard-title">{content.heading}</h1>
        <p className="present-live-guard-copy">{content.copy}</p>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate(content.path)}>{content.button}</button>
      </div>
    </div>
  );
}
