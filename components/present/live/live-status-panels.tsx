import { useEffect, useRef, type KeyboardEvent } from "react";
import { QrCode } from "@/components/shared/qr-code";
import { DISPLAY_SITE_HOST } from "@/lib/config/public";

type StatusRailProps = {
  channelJoined: boolean;
  currentIndex: number;
  slideCount: number;
  title: string;
  joinCode: string | null;
  resultsHidden: boolean;
  responseCount: number;
  onShowJoin: () => void;
};

export function LiveStatusRail({ channelJoined, currentIndex, slideCount, title, joinCode, resultsHidden, responseCount, onShowJoin }: StatusRailProps) {
  return (
    <div className="present-live-status-rail">
      <div className="present-live-status-pill">
        <span className={channelJoined ? "present-live-status-dot is-connected" : "present-live-status-dot"} />
        <span className="present-live-status-count">{currentIndex + 1}/{slideCount}</span>
        <span className="present-live-status-title">{title}</span>
      </div>
      {joinCode && <button className="present-live-join-chip" onClick={onShowJoin}>Join: {joinCode}</button>}
      <div className="present-live-status-spacer" />
      <div className={resultsHidden ? "present-live-results-chip is-hidden" : "present-live-results-chip"}>
        {resultsHidden ? "Results hidden" : "Results visible"} · {responseCount} responses
      </div>
    </div>
  );
}

type JoinOverlayProps = {
  joinCode: string;
  joinUrl: string;
  onClose: () => void;
};

export function JoinOverlay({ joinCode, joinUrl, onClose }: JoinOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Move focus into the overlay and give it back to whatever opened it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { if (previous && document.contains(previous)) previous.focus(); };
  }, []);
  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="present-join-overlay" onClick={onClose}>
      <div ref={dialogRef} className="present-join-overlay-card" role="dialog" aria-modal="true" aria-label="Audience join code" onClick={(e) => e.stopPropagation()} onKeyDown={trapFocus}>
        <button ref={closeRef} type="button" className="present-join-overlay-close" onClick={onClose} aria-label="Close join code and show presenter controls">
          Close ✕
        </button>
        <div className="present-join-overlay-label">Audience join</div>
        <div className="present-join-overlay-code">{joinCode}</div>
        <div className="present-join-overlay-body">
          <QrCode value={joinUrl} size={260} label="Scan to join" className="qr-code" />
          <div className="present-join-overlay-copy">
            <div className="present-join-overlay-title">Scan or enter the code</div>
            <div className="present-join-overlay-url">{DISPLAY_SITE_HOST}/present/join</div>
            <button onClick={() => { void navigator.clipboard?.writeText(joinUrl); }} className="btn btn-primary btn-lg">Copy invite link</button>
            <div className="present-join-overlay-hint">Close this to reach the slide controls. Press I to show it again.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

type HostDockProps = {
  channelJoined: boolean;
  currentIndex: number;
  slideCount: number;
  resultsHidden: boolean;
  isFullscreen: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJoin: () => void;
  onToggleResults: () => void;
  onToggleFullscreen: () => void;
  onEnd: () => void;
};

export function HostDock({ channelJoined, currentIndex, slideCount, resultsHidden, isFullscreen, onPrev, onNext, onJoin, onToggleResults, onToggleFullscreen, onEnd }: HostDockProps) {
  return (
    <div className="present-host-dock">
      <button className="present-dock-button" onClick={onPrev} disabled={currentIndex === 0 || !channelJoined}>← Prev</button>
      <button className="present-dock-button is-primary" onClick={onNext} disabled={currentIndex === slideCount - 1 || !channelJoined}>Next →</button>
      <button className="present-dock-button" onClick={onJoin}>Join</button>
      <button className="present-dock-button" onClick={onToggleResults}>{resultsHidden ? "Reveal" : "Hide"}</button>
      <button className="present-dock-button" onClick={onToggleFullscreen}>{isFullscreen ? "Exit" : "Fullscreen"}</button>
      <button
        className="present-dock-button is-danger"
        onClick={() => {
          if (window.confirm("End the presentation for everyone? This cannot be undone.")) {
            onEnd();
          }
        }}
        disabled={!channelJoined}
      >End</button>
    </div>
  );
}
