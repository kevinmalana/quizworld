# Run from services/quizworld_realtime with MIX_ENV=test mix run --no-start
# ../../docs/engine/local_probe.exs OUTPUT.json [BASELINE_SHA]
# Synthetic local actors only: no HTTP/WebSocket clients, Redis or Supabase I/O.
if Mix.env() != :test, do: raise("This probe requires MIX_ENV=test")
[output | optional_baseline] = System.argv()

baseline = List.first(optional_baseline)

if baseline do
  unless Regex.match?(~r/\A[0-9a-f]{40}\z/, baseline), do: raise("Expected full baseline SHA")
  Code.compiler_options(ignore_module_conflict: true)

  for file <- ["games.ex", "game_server.ex"] do
    path = "services/quizworld_realtime/lib/quizworld_realtime/" <> file
    {source, 0} = System.cmd("git", ["show", baseline <> ":" <> path])
    Code.compile_string(source, path)
  end
end

defmodule QuizworldRealtime.EngineProbe.NoResultSync do
  def persist_finished_game(_game), do: {:error, :local_probe_persistence_disabled}
end

for {key, value} <- [
      redis_url: nil,
      supabase_url: nil,
      supabase_service_role_key: nil,
      game_store: QuizworldRealtime.TestGameStore,
      result_sync_module: QuizworldRealtime.EngineProbe.NoResultSync
    ] do
  Application.put_env(:quizworld_realtime, key, value)
end

endpoint = Application.get_env(:quizworld_realtime, QuizworldRealtimeWeb.Endpoint)

Application.put_env(
  :quizworld_realtime,
  QuizworldRealtimeWeb.Endpoint,
  Keyword.put(endpoint, :server, false)
)

{:ok, _} = Application.ensure_all_started(:quizworld_realtime)
Logger.configure(level: :error)

defmodule QuizworldRealtime.EngineProbe do
  alias QuizworldRealtime.{Game, GameServer, Games, TestGameStore}

  def run(players, rounds, repeat) do
    pin = "PROBE#{players}R#{repeat}"
    {game, credentials} = fixture(pin, players, rounds, 300)
    {:ok, pid} = GameServer.start_link(game)

    listeners = [
      listener([Games.topic(pin), Games.host_topic(pin)])
      | Enum.map(credentials, fn {id, _} ->
          listener([Games.topic(pin), Games.player_topic(pin, id)])
        end)
    ]

    sampler = spawn_link(fn -> sample(pid, %{max_queue: 0, max_process_bytes: 0}) end)
    started = now()

    rows =
      for index <- 1..rounds do
        round_start = now()

        latencies =
          credentials
          |> Task.async_stream(
            fn {id, token} ->
              start = now()
              result = Games.submit_answer(pin, id, token, "a#{index}", -999)

              {now() - start,
               case result do
                 {:ok, _} -> :ok
                 {:error, reason} -> reason
               end}
            end,
            max_concurrency: players,
            timeout: 10_000,
            ordered: false
          )
          |> Enum.map(fn {:ok, value} -> value end)

        row = %{
          round: index,
          elapsed_us: now() - round_start,
          calls_us: Enum.map(latencies, &elem(&1, 0)),
          errors:
            latencies |> Enum.reject(&(elem(&1, 1) == :ok)) |> Enum.map(&to_string(elem(&1, 1)))
        }

        if index < rounds, do: {:ok, _} = Games.advance(pin, game.host_token)
        row
      end

    elapsed = now() - started
    host = GameServer.snapshot(pin, :host)
    if host.status != "reveal", do: raise("Probe did not reach final reveal")
    {:ok, current} = TestGameStore.fetch_game(pin)

    unless map_size(current.answers) == rounds and
             Enum.all?(current.answers, fn {_, answers} -> map_size(answers) == players end),
           do: raise("Missing synthetic answers")

    auth_us =
      for _ <- 1..100 do
        {us, {:ok, _, :host}} =
          :timer.tc(fn -> Games.authorized_snapshot(pin, %{"host_token" => game.host_token}) end)

        us
      end

    {encode_us, encoded_host} = :timer.tc(fn -> Jason.encode!(host) end)
    {first_id, _} = hd(credentials)

    sizes = %{
      host_json_bytes: byte_size(encoded_host),
      public_json_bytes: byte_size(Jason.encode!(Game.snapshot_for_role(host, :public))),
      player_json_bytes:
        byte_size(Jason.encode!(Game.snapshot_for_role(host, {:player, first_id}))),
      host_encode_us: encode_us,
      persisted_term_bytes: byte_size(:erlang.term_to_binary(Game.for_persistence(current)))
    }

    send(sampler, {:stop, self()})

    maxima =
      receive do
        {:sample, result} -> result
      after
        1000 -> raise("sampler timeout")
      end

    for l <- listeners, do: send(l, :stop)
    GenServer.stop(pid, :normal)
    TestGameStore.delete_snapshot(pin)

    %{
      players: players,
      rounds: rounds,
      repeat: repeat,
      answer_calls: players * rounds,
      total_us: elapsed,
      answer_latency_us: stats(Enum.flat_map(rows, & &1.calls_us)),
      auth_snapshot_latency_us: stats(auth_us),
      sizes: sizes,
      sampled: maxima,
      round_rows:
        Enum.map(rows, fn row ->
          Map.put(Map.delete(row, :calls_us), :latency_us, stats(row.calls_us))
        end)
    }
  end

  def deadline(repeat) do
    pin = "DEADLINE#{repeat}"
    {waiting, _} = fixture(pin, 2, 1, 1, false)
    {:ok, pid} = GameServer.start_link(waiting)
    Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, Games.topic(pin))
    {start_us, {:ok, _}} = :timer.tc(fn -> Games.start_game(pin, waiting.host_token) end)
    # UTC is the engine's deadline clock. Use it only for this comparison;
    # all benchmark latencies above use monotonic time.
    lag = await_reveal()
    Phoenix.PubSub.unsubscribe(QuizworldRealtime.PubSub, Games.topic(pin))
    GenServer.stop(pid, :normal)
    TestGameStore.delete_snapshot(pin)
    %{start_call_us: start_us, reveal_delivery_lag_ms: lag}
  end

  def timeout do
    {game, [{id, token} | _]} = fixture("TIMEOUT", 2, 1, 60)
    {:ok, pid} = GameServer.start_link(game)
    :ok = :sys.suspend(pid)
    {us, result} = :timer.tc(fn -> Games.submit_answer(game.pin, id, token, "a1", 0) end)
    {:messages, messages} = Process.info(pid, :messages)
    count = Enum.count(messages, &match?({:"$gen_call", _, {:submit_answer, _, _, _, _}}, &1))
    :ok = :sys.resume(pid)
    {:ok, recovered} = Games.reconnect_player(game.pin, id, token)
    GenServer.stop(pid, :normal)
    TestGameStore.delete_snapshot(game.pin)

    %{
      elapsed_us: us,
      returned: inspect(result),
      queued_answer_commands: count,
      answers_after_resume: length(recovered.current_answers)
    }
  end

  defp await_reveal do
    receive do
      {:session_updated, %{status: "reveal", question_started_at: started}} ->
        DateTime.diff(DateTime.utc_now(), DateTime.add(started, 1, :second), :millisecond)

      {:session_updated, _} ->
        await_reveal()
    after
      3000 -> raise("automatic reveal timed out")
    end
  end

  defp fixture(pin, players, rounds, seconds, active \\ true) do
    game =
      Game.new(%{
        "pin" => pin,
        "host_id" => "local-host",
        "quiz_id" => "local-quiz",
        "questions" =>
          Enum.map(1..rounds, fn i ->
            %{
              "id" => "q#{i}",
              "text" => "Synthetic question #{i}",
              "order_index" => i,
              "time_limit" => seconds,
              "points" => 1000,
              "answers" => [
                %{"id" => "a#{i}", "text" => "Correct", "is_correct" => true},
                %{"id" => "b#{i}", "text" => "Wrong", "is_correct" => false}
              ]
            }
          end)
      })

    {game, credentials} =
      Enum.reduce(1..players, {game, []}, fn i, {g, cs} ->
        {:ok, g, token, id} = Game.join_player(g, %{"nickname" => "Local #{i}"})
        {g, [{id, token} | cs]}
      end)

    game =
      if active do
        {:ok, g} = Game.start(game, game.host_token)
        g
      else
        game
      end

    {game, credentials}
  end

  defp listener(topics) do
    owner = self()

    pid =
      spawn_link(fn ->
        for topic <- topics, do: Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, topic)
        send(owner, {:ready, self()})
        drain()
      end)

    receive do
      {:ready, ^pid} -> pid
    after
      1000 -> raise("listener timeout")
    end
  end

  defp drain do
    receive do
      :stop -> :ok
      _ -> drain()
    end
  end

  defp sample(pid, maxima) do
    values = Process.info(pid, [:message_queue_len, :memory])

    next = %{
      max_queue: max(maxima.max_queue, values[:message_queue_len]),
      max_process_bytes: max(maxima.max_process_bytes, values[:memory])
    }

    receive do
      {:stop, owner} -> send(owner, {:sample, next})
    after
      2 -> sample(pid, next)
    end
  end

  defp stats(values) do
    sorted = Enum.sort(values)
    n = length(sorted)

    %{
      count: n,
      p50: Enum.at(sorted, max(ceil(n * 0.50) - 1, 0)),
      p95: Enum.at(sorted, max(ceil(n * 0.95) - 1, 0)),
      p99: Enum.at(sorted, max(ceil(n * 0.99) - 1, 0)),
      max: List.last(sorted)
    }
  end

  defp now, do: System.monotonic_time(:microsecond)
end

results =
  for {players, rounds} <- [{50, 10}, {200, 20}],
      repeat <- 1..3,
      do: QuizworldRealtime.EngineProbe.run(players, rounds, repeat)

{head, 0} = System.cmd("git", ["rev-parse", "HEAD"])

report = %{
  recorded_at: DateTime.utc_now(),
  source: baseline || "candidate-worktree",
  checkout_head: String.trim(head),
  elixir: System.version(),
  otp: List.to_string(:erlang.system_info(:otp_release)),
  schedulers: :erlang.system_info(:schedulers_online),
  conditions:
    "Single local VM, synthetic classic games, TestGameStore, PubSub drain listeners; no network clients, JSON transport, Redis, Supabase, persistence success or production load claim.",
  runs: results,
  quiet_deadline_samples: Enum.map(1..5, &QuizworldRealtime.EngineProbe.deadline/1),
  suspended_answer: QuizworldRealtime.EngineProbe.timeout()
}

File.write!(output, Jason.encode!(report, pretty: true))

IO.puts(
  "Probe wrote #{output}: #{length(results)} load runs, 5 quiet deadline samples, 1 suspended-call sample"
)
