"use client";

import { useState } from "react";

export function GameErrorState({
  error,
  onRetry,
  onHome,
}: {
  error: string;
  onRetry?: () => void;
  onHome?: () => void;
}) {
  return (
    <div className="container game-error-state">
      <div className="card game-error-card">
        <div className="game-error-icon">⚠️</div>
        <h2 className="font-display game-error-title">Something went wrong</h2>
        <p className="game-error-message">{error}</p>
        <div className="game-error-actions">
          {onRetry && (
            <button onClick={onRetry} className="btn btn-primary">
              Try Again
            </button>
          )}
          {onHome && (
            <button onClick={onHome} className="btn btn-secondary">
              Back to Home
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ErrorMessage({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="game-inline-error">
      <span className="game-inline-error-icon">⚠️</span>
      <span className="game-inline-error-text">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="game-inline-error-dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="container game-loading-state">
      <div className="game-loading-spinner" />
      <p className="game-loading-message">{message}</p>
    </div>
  );
}
