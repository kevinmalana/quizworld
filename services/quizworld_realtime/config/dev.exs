import Config

config :quizworld_realtime, QuizworldRealtimeWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT") || "4100")],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: String.duplicate("dev-secret-", 8),
  watchers: []
