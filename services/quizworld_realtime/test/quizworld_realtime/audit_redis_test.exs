defmodule QuizworldRealtime.AuditRedisTest do
  use ExUnit.Case, async: false
  alias QuizworldRealtime.{Game, StateStore, RateLimiter}

  setup_all do
    socket =
      Path.join(System.tmp_dir!(), "quizworld-audit-#{System.unique_integer([:positive])}.sock")

    {_, 0} =
      System.cmd("redis-server", [
        "--port",
        "0",
        "--unixsocket",
        socket,
        "--save",
        "",
        "--appendonly",
        "no",
        "--daemonize",
        "yes"
      ])

    {:ok, redis} = Redix.start_link(host: {:local, socket}, name: QuizworldRealtime.Redis)

    on_exit(fn ->
      {:ok, cleanup} = Redix.start_link(host: {:local, socket})
      Redix.command(cleanup, ["SHUTDOWN", "NOSAVE"])
      File.rm(socket)
    end)

    %{redis: redis}
  end

  setup do
    {:ok, "OK"} = Redix.command(QuizworldRealtime.Redis, ["FLUSHDB"])
    :ok
  end

  test "four simultaneous 200-player classes behind one NAT retain bounded join answer and fallback capacity" do
    for {method, path, capacity, max} <- [
          {"POST", "/api/sessions/ABC/join", 1600, 2000},
          {"POST", "/api/presentations/join", 1600, 2000},
          {"POST", "/api/sessions/ABC/answer", 19200, 24000},
          {"GET", "/api/sessions/ABC", 19200, 24000},
          {"GET", "/api/presentations/ABC", 19200, 24000},
          {"GET", "/api/presentations/ABC/slides/1/activity", 38400, 48000}
        ] do
      assert :ok == RateLimiter.check(method, path, "school")
      route = path |> String.replace("ABC", "*") |> String.replace("/1/", "/*/")
      hash = :crypto.hash(:sha256, "school") |> Base.encode16(case: :lower)
      key = "quizworld:rate:#{method}:#{route}:#{hash}"
      # Seed real Redis counters to the workload and cap boundaries instead of
      # spending a minute issuing 100,000 serial network requests in CI.
      assert {:ok, "1"} = Redix.command(QuizworldRealtime.Redis, ["GET", key])
      {:ok, "OK"} = Redix.command(QuizworldRealtime.Redis, ["SET", key, capacity - 1, "EX", 60])
      assert :ok == RateLimiter.check(method, path, "school")
      {:ok, "OK"} = Redix.command(QuizworldRealtime.Redis, ["SET", key, max - 1, "EX", 60])
      assert :ok == RateLimiter.check(method, path, "school")

      assert {:error, retry_after} =
               RateLimiter.check(method, String.replace(path, "ABC", "OTHER"), "school")

      assert retry_after in 1..60
      assert :ok == RateLimiter.check(method, path, "another-school")
    end

    results =
      Task.async_stream(
        1..800,
        fn i ->
          RateLimiter.check("POST", "/api/sessions/CLASS#{rem(i, 4)}/join", "burst-school")
        end,
        max_concurrency: 20
      )

    assert Enum.all?(results, &(&1 == {:ok, :ok}))
  end

  test "finished pending snapshots have no TTL and enter a durable instance index" do
    game = pending_game()
    assert :ok = StateStore.persist_game(game)

    assert {:ok, -1} =
             Redix.command(QuizworldRealtime.Redis, ["TTL", "quizworld:games:" <> game.pin])

    assert {:ok, [id]} =
             Redix.command(QuizworldRealtime.Redis, ["SMEMBERS", "quizworld:pending_results"])

    assert id == game.instance_id

    assert {:ok, -1} =
             Redix.command(QuizworldRealtime.Redis, ["TTL", "quizworld:pending_results:" <> id])
  end

  test "in-flight results restore as pending and only successful persistence releases the outbox" do
    game = pending_game()

    :ok =
      StateStore.persist_game(%{
        game
        | result_sync_status: :in_flight,
          result_sync_ref: make_ref()
      })

    assert {:ok, %{result_sync_status: :pending, result_sync_ref: nil}, _} =
             StateStore.fetch_pending(game.instance_id)

    assert {:ok, -1} =
             Redix.command(QuizworldRealtime.Redis, ["TTL", "quizworld:games:" <> game.pin])

    :ok = StateStore.persist_game(%{game | result_sync_status: :succeeded})
    assert {:error, :not_found} = StateStore.fetch_pending(game.instance_id)

    assert {:ok, []} =
             Redix.command(QuizworldRealtime.Redis, ["SMEMBERS", "quizworld:pending_results"])

    assert {:ok, ttl} =
             Redix.command(QuizworldRealtime.Redis, ["TTL", "quizworld:games:" <> game.pin])

    assert ttl in 1..21600
    active = Game.new(%{"pin" => "ACTIVE", "questions" => []})
    :ok = StateStore.persist_game(active)
    assert {:ok, ttl} = Redix.command(QuizworldRealtime.Redis, ["TTL", "quizworld:games:ACTIVE"])
    assert ttl in 1..21600
  end

  test "startup recovery retries without any client read and survives worker restart" do
    game = pending_game()
    :ok = StateStore.persist_game(game)
    Application.put_env(:quizworld_realtime, :audit_recovery_observer, self())
    on_exit(fn -> Application.delete_env(:quizworld_realtime, :audit_recovery_observer) end)

    {:ok, worker} =
      QuizworldRealtime.ResultRecovery.start_link(
        name: nil,
        interval: 20,
        sync_module: QuizworldRealtime.AuditRecoverySync,
        enabled: true
      )

    assert_receive {:recovering, id, task}, 1000
    assert id == game.instance_id
    send(task, {:complete, {:error, :offline}})
    assert_receive {:recovering, ^id, task}, 1000
    GenServer.stop(worker)
    send(task, {:complete, {:error, :offline}})
    assert {:ok, _, _} = StateStore.fetch_pending(id)

    {:ok, worker} =
      QuizworldRealtime.ResultRecovery.start_link(
        name: nil,
        interval: 20,
        sync_module: QuizworldRealtime.AuditRecoverySync,
        enabled: true
      )

    assert_receive {:recovering, ^id, task}, 1000
    send(task, {:complete, :ok})
    eventually(fn -> assert {:error, :not_found} = StateStore.fetch_pending(id) end)
    assert {:ok, %{result_sync_status: :succeeded}} = StateStore.fetch_game(game.pin)
    GenServer.stop(worker)
  end

  test "legacy expiring pending snapshots are discovered on startup" do
    game = pending_game()
    payload = :erlang.term_to_binary({1, game})

    {:ok, "OK"} =
      Redix.command(QuizworldRealtime.Redis, [
        "SET",
        "quizworld:games:" <> game.pin,
        payload,
        "EX",
        "1"
      ])

    Application.put_env(:quizworld_realtime, :audit_recovery_observer, self())
    on_exit(fn -> Application.delete_env(:quizworld_realtime, :audit_recovery_observer) end)

    {:ok, worker} =
      QuizworldRealtime.ResultRecovery.start_link(
        name: nil,
        interval: 20,
        sync_module: QuizworldRealtime.AuditRecoverySync,
        enabled: true
      )

    assert_receive {:recovering, id, task}, 1000
    assert id == game.instance_id

    assert {:ok, -1} =
             Redix.command(QuizworldRealtime.Redis, ["TTL", "quizworld:games:" <> game.pin])

    send(task, {:complete, :ok})
    eventually(fn -> assert {:error, :not_found} = StateStore.fetch_pending(id) end)
    GenServer.stop(worker)
  end

  test "one slow pending report does not block another completion" do
    first = pending_game()
    second = %{pending_game() | pin: "OTHER"}
    :ok = StateStore.persist_game(first)
    :ok = StateStore.persist_game(second)
    Application.put_env(:quizworld_realtime, :audit_recovery_observer, self())
    on_exit(fn -> Application.delete_env(:quizworld_realtime, :audit_recovery_observer) end)

    {:ok, worker} =
      QuizworldRealtime.ResultRecovery.start_link(
        name: nil,
        interval: 20,
        sync_module: QuizworldRealtime.AuditRecoverySync,
        enabled: true
      )

    assert_receive {:recovering, id1, task1}, 1000
    assert_receive {:recovering, id2, task2}, 1000
    assert MapSet.new([id1, id2]) == MapSet.new([first.instance_id, second.instance_id])
    send(task1, {:complete, :ok})
    send(task2, {:complete, :ok})
    eventually(fn -> assert {:error, :not_found} = StateStore.fetch_pending(id1) end)
    eventually(fn -> assert {:error, :not_found} = StateStore.fetch_pending(id2) end)
    GenServer.stop(worker)
  end

  test "pre-instance-ID v1 checkpoints are adopted atomically for recovery" do
    game = pending_game() |> Map.delete(:instance_id)
    payload = :erlang.term_to_binary({1, game})

    {:ok, "OK"} =
      Redix.command(QuizworldRealtime.Redis, [
        "SET",
        "quizworld:games:" <> game.pin,
        payload,
        "EX",
        "60"
      ])

    assert {:ok, _} = StateStore.discover_pending("0")
    assert {:ok, adopted} = StateStore.fetch_game(game.pin)
    assert is_binary(adopted.instance_id)
    assert {:ok, _, _} = StateStore.fetch_pending(adopted.instance_id)
    assert {:ok, _} = StateStore.discover_pending("0")
    assert {:ok, again} = StateStore.fetch_game(game.pin)
    assert again.instance_id == adopted.instance_id
  end

  test "a stale acknowledgement cannot remove a newer checkpoint" do
    game = pending_game()
    :ok = StateStore.persist_game(game)
    {:ok, old, payload} = StateStore.fetch_pending(game.instance_id)
    updated = %{game | result_sync_attempts: 5}
    :ok = StateStore.persist_game(updated)
    :ok = StateStore.acknowledge_pending(game.instance_id, old, payload)
    assert {:ok, %{result_sync_attempts: 5}, _} = StateStore.fetch_pending(game.instance_id)
  end

  test "missing Redis and Redis command errors are surfaced rather than reported as saved", %{
    redis: redis
  } do
    Process.unregister(QuizworldRealtime.Redis)

    try do
      assert {:error, :redis_unavailable} = StateStore.persist_game(pending_game())
    after
      Process.register(redis, QuizworldRealtime.Redis)
    end

    {:ok, "OK"} = Redix.command(redis, ["SET", "quizworld:pending_results", "wrong-type"])
    assert {:error, %Redix.Error{}} = StateStore.persist_game(pending_game())
  end

  test "PIN reuse and room cleanup cannot delete an older unsent result" do
    game = pending_game()
    :ok = StateStore.persist_game(game)
    assert {:ok, pending, payload} = StateStore.fetch_pending(game.instance_id)
    replacement = Game.new(%{"pin" => game.pin, "questions" => []})
    :ok = StateStore.persist_game(replacement)
    :ok = StateStore.acknowledge_pending(game.instance_id, pending, payload)
    assert {:ok, stored} = StateStore.fetch_game(game.pin)
    assert stored.instance_id == replacement.instance_id
    :ok = StateStore.persist_game(game)
    :ok = StateStore.delete_snapshot(game.pin)
    assert {:ok, _, _} = StateStore.fetch_pending(game.instance_id)
  end

  defp eventually(assertion, attempts \\ 100)

  defp eventually(assertion, attempts) do
    assertion.()
  rescue
    error in ExUnit.AssertionError ->
      if attempts == 0, do: reraise(error, __STACKTRACE__)
      Process.sleep(10)
      eventually(assertion, attempts - 1)
  end

  defp pending_game do
    game = Game.new(%{"pin" => "DURABLE", "questions" => []})
    %{game | status: "finished", result_sync_status: :pending}
  end
end
