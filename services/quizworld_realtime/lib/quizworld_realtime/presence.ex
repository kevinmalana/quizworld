defmodule QuizworldRealtime.Presence do
  @moduledoc """
  Phoenix Presence for tracking connected players per game session.
  Exposes real connection counts to the host dashboard.
  """
  use Phoenix.Presence,
    otp_app: :quizworld_realtime,
    pubsub_server: QuizworldRealtime.PubSub
end
