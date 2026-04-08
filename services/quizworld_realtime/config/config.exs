import Config

config :quizworld_realtime,
  generators: [timestamp_type: :utc_datetime]

config :quizworld_realtime, QuizworldRealtimeWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [json: QuizworldRealtimeWeb.ErrorJSON], layout: false],
  pubsub_server: QuizworldRealtime.PubSub,
  live_view: [signing_salt: "quizworld"]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
