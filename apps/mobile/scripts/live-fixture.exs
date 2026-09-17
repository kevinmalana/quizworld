# Isolated synthetic backend for mobile acceptance. Never load production env.
# Run from services/quizworld_realtime:
# MIX_ENV=test mix run --no-start ../../apps/mobile/scripts/live-fixture.exs
if Mix.env() != :test, do: raise("MIX_ENV=test required")

defmodule QuizworldRealtime.MobileFixture.NoResults do
  def persist_finished_game(_game), do: :ok
end

for {key, value} <- [
      redis_url: nil,
      supabase_url: nil,
      supabase_service_role_key: nil,
      allowed_origins: ["http://127.0.0.1:8085"],
      game_store: QuizworldRealtime.TestGameStore,
      result_sync_module: QuizworldRealtime.MobileFixture.NoResults
    ] do
  Application.put_env(:quizworld_realtime, key, value)
end

endpoint = Application.get_env(:quizworld_realtime, QuizworldRealtimeWeb.Endpoint)

Application.put_env(
  :quizworld_realtime,
  QuizworldRealtimeWeb.Endpoint,
  Keyword.merge(endpoint,
    server: true,
    http: [ip: {127, 0, 0, 1}, port: 4187],
    check_origin: ["http://127.0.0.1:8085", "https://www.quizworld.xyz"]
  )
)

Logger.configure(level: :warning)
{:ok, _} = Application.ensure_all_started(:quizworld_realtime)

rooms =
  for pin <- ["APP001", "APP002", "APP003", "FULL01"] do
    {:ok, _, token} =
      QuizworldRealtime.Games.create_session(%{
        "pin" => pin,
        "host_id" => "local-fixture-host",
        "quiz_id" => "local-fixture-quiz",
        "questions" =>
          for i <- 1..2 do
            %{
              "id" => "q#{i}",
              "text" => "Local acceptance question #{i}",
              "time_limit" => 120,
              "points" => 1000,
              "order_index" => i - 1,
              "answers" => [
                %{
                  "id" => "a#{i}",
                  "text" => "Correct fixture answer",
                  "image_url" => "https://quizworld-fixture.invalid/answer.svg",
                  "is_correct" => true
                },
                %{"id" => "b#{i}", "text" => "Other fixture answer", "is_correct" => false}
              ]
            }
          end
      })

    {pin, token}
  end

for i <- 1..200 do
  {:ok, _, _, _} = QuizworldRealtime.Games.join_player("FULL01", %{"nickname" => "Fixture #{i}"})
end

{:ok, _, _, _} =
  QuizworldRealtime.Games.join_player("APP003", %{"nickname" => "Existing fixture"})

{:ok, _} = QuizworldRealtime.Games.start_game("APP003", Map.new(rooms)["APP003"])
path = System.get_env("MOBILE_FIXTURE_CREDENTIALS") || "/tmp/quizworld-mobile-fixture.json"
File.write!(path, Jason.encode!(Map.new(rooms)))
File.chmod!(path, 0o600)
IO.puts("Mobile isolated Phoenix ready at http://127.0.0.1:4187 (no durable results)")
Process.sleep(:infinity)
