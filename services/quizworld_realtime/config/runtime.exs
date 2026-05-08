import Config

port = String.to_integer(System.get_env("PORT") || "4100")
host = System.get_env("PHX_HOST") || "localhost"

secret_key_base =
  System.get_env("SECRET_KEY_BASE") ||
    if config_env() == :prod do
      raise "SECRET_KEY_BASE is required in production"
    else
      "dev-only-secret-key-base-replace-me-dev-only-secret-key-base"
    end

redis_url = System.get_env("REDIS_URL")
supabase_url = System.get_env("SUPABASE_URL")
supabase_service_role_key = System.get_env("SUPABASE_SERVICE_ROLE_KEY")

allowed_origins =
  System.get_env("ALLOWED_ORIGINS", "https://www.quizworld.xyz,https://quizworld.xyz,http://localhost:3000")
  |> String.split(",", trim: true)

config :quizworld_realtime,
  redis_url: redis_url,
  supabase_url: supabase_url,
  supabase_service_role_key: supabase_service_role_key,
  allowed_origins: allowed_origins

config :quizworld_realtime, QuizworldRealtimeWeb.Endpoint,
  server: true,
  url: [host: host, port: 443, scheme: "https"],
  http: [ip: {0, 0, 0, 0}, port: port],
  secret_key_base: secret_key_base,
  check_origin: allowed_origins
