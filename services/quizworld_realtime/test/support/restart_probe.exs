# Standalone integration probe: MIX_ENV=test mix run --no-start test/support/restart_probe.exs
# Owns a fresh loopback Redis and fake HTTP RPC; never reads production services.
defmodule QuizworldRealtime.RestartProbeRPC do
  import Plug.Conn
  def init(opts), do: opts

  def call(conn, _) do
    {:ok, body, conn} = read_body(conn)

    send(
      Process.whereis(:restart_probe_owner),
      {:result_rpc, conn.request_path, Jason.decode!(body)}
    )

    conn |> put_resp_content_type("application/json") |> send_resp(200, "null")
  end
end

Process.register(self(), :restart_probe_owner)
{:ok, listener} = :gen_tcp.listen(0, ip: {127, 0, 0, 1})
{:ok, {_, port}} = :inet.sockname(listener)
:gen_tcp.close(listener)

{_, 0} =
  System.cmd("redis-server", [
    "--bind",
    "127.0.0.1",
    "--port",
    to_string(port),
    "--save",
    "",
    "--appendonly",
    "no",
    "--daemonize",
    "yes"
  ])

Application.put_env(:quizworld_realtime, :redis_url, "redis://127.0.0.1:#{port}")
Application.put_env(:quizworld_realtime, :game_store, QuizworldRealtime.StateStore)

try do
  {:ok, _} = Application.ensure_all_started(:quizworld_realtime)
  :ok = Supervisor.terminate_child(QuizworldRealtime.Supervisor, QuizworldRealtime.ResultRecovery)

  {:ok, http} =
    Bandit.start_link(plug: QuizworldRealtime.RestartProbeRPC, port: 0, ip: {127, 0, 0, 1})

  {:ok, {_, http_port}} = ThousandIsland.listener_info(http)
  Application.put_env(:quizworld_realtime, :supabase_url, "http://127.0.0.1:#{http_port}")
  Application.put_env(:quizworld_realtime, :supabase_service_role_key, "local-test-key")
  game = QuizworldRealtime.Game.new(%{"pin" => "BOOT", "questions" => []})
  game = %{game | status: "finished", result_sync_status: :pending}
  :ok = QuizworldRealtime.StateStore.persist_game(game)
  :ok = Application.stop(:quizworld_realtime)
  :ok = Application.start(:quizworld_realtime)

  receive do
    {:result_rpc, "/rest/v1/rpc/record_game_result_v2", %{"p_game_instance_id" => id}}
    when id == game.instance_id ->
      :ok
  after
    5000 -> raise "boot recovery never sent the result RPC"
  end

  Enum.reduce_while(1..100, nil, fn _, _ ->
    case QuizworldRealtime.StateStore.fetch_pending(game.instance_id) do
      {:error, :not_found} ->
        {:halt, :ok}

      _ ->
        Process.sleep(10)
        {:cont, nil}
    end
  end) == :ok || raise "boot recovery failed to acknowledge result"

  {:ok, %{result_sync_status: :succeeded}} = QuizworldRealtime.StateStore.fetch_game(game.pin)

  IO.puts(
    "PASS application stop/start recovered and acknowledged pending result without client traffic"
  )
after
  Application.stop(:quizworld_realtime)
  {:ok, redis} = Redix.start_link(host: "127.0.0.1", port: port)
  Redix.command(redis, ["SHUTDOWN", "NOSAVE"])
end
