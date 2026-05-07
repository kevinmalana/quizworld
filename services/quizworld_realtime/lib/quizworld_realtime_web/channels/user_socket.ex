defmodule QuizworldRealtimeWeb.UserSocket do
  use Phoenix.Socket

  channel "game:*", QuizworldRealtimeWeb.GameChannel
  channel "presentation:*", QuizworldRealtimeWeb.PresentationChannel

  @impl true
  def connect(_params, socket, _connect_info), do: {:ok, socket}

  @impl true
  def id(_socket), do: nil
end
