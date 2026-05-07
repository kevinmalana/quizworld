defmodule QuizworldRealtimeWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :quizworld_realtime

  @session_options [
    store: :cookie,
    key: "_quizworld_realtime_key",
    signing_salt: "v9salt"
  ]

  plug Plug.Static,
    at: "/",
    from: :quizworld_realtime,
    gzip: false,
    only: ~w(css)

  socket "/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]]

  socket "/socket", QuizworldRealtimeWeb.UserSocket,
    websocket: true,
    longpoll: false

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug QuizworldRealtimeWeb.Plugs.CORS

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options

  plug QuizworldRealtimeWeb.Router
end
