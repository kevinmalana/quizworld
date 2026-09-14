defmodule QuizworldRealtimeWeb.ChannelInstanceTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  @endpoint QuizworldRealtimeWeb.Endpoint
  alias QuizworldRealtime.{Games, TestGameStore}
  alias QuizworldRealtimeWeb.{GameChannel, UserSocket}

  setup do
    pin = "INSTANCE#{System.unique_integer([:positive])}"

    attrs = %{
      "pin" => pin,
      "host_id" => "old",
      "quiz_id" => "old",
      "questions" => [
        %{
          "id" => "q",
          "text" => "Question",
          "time_limit" => 60,
          "answers" => [%{"id" => "a", "text" => "Right", "is_correct" => true}]
        }
      ]
    }

    {:ok, _, host} = Games.create_session(attrs)

    on_exit(fn ->
      for {pid, _} <- Registry.lookup(QuizworldRealtime.GameRegistry, pin),
          do: DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, pid)

      TestGameStore.delete_snapshot(pin)
    end)

    %{pin: pin, attrs: attrs, host: host}
  end

  test "credentialed reconnect preserves host-player analytics and rejects invalid composed credentials",
       ctx do
    {:ok, _, token, player} = Games.join_player(ctx.pin, %{"nickname" => "Host player"})
    conn = Plug.Test.conn(:post, "/")

    params = %{
      "pin" => ctx.pin,
      "host_token" => ctx.host,
      "player_id" => player,
      "player_token" => token
    }

    reply = QuizworldRealtimeWeb.SessionController.reconnect(conn, params)
    assert reply.status == 200
    assert Map.has_key?(Jason.decode!(reply.resp_body)["session"], "question_history")

    invalid =
      QuizworldRealtimeWeb.SessionController.reconnect(conn, %{params | "player_token" => "wrong"})

    assert invalid.status == 422

    host_only =
      QuizworldRealtimeWeb.SessionController.reconnect(
        conn,
        Map.take(params, ["pin", "host_token"])
      )

    assert host_only.status == 200
  end

  test "HTTP mutations preserve structured reasons", ctx do
    {:ok, _, token, player} = Games.join_player(ctx.pin, %{"nickname" => "Answerer"})

    reply =
      QuizworldRealtimeWeb.SessionController.answer(Plug.Test.conn(:post, "/"), %{
        "pin" => ctx.pin,
        "player_id" => player,
        "player_token" => token,
        "answer_id" => "a"
      })

    assert reply.status == 422
    assert Jason.decode!(reply.resp_body)["reason"] == "invalid_state"
  end

  test "temporary public read timeout is not a missing-room response", ctx do
    [{pid, _}] = Registry.lookup(QuizworldRealtime.GameRegistry, ctx.pin)
    :ok = :sys.suspend(pid)

    try do
      reply =
        QuizworldRealtimeWeb.SessionController.show(Plug.Test.conn(:get, "/"), %{"pin" => ctx.pin})

      assert reply.status == 504
      assert Jason.decode!(reply.resp_body)["reason"] == "timeout"
    after
      :sys.resume(pid)
    end
  end

  defp replace(ctx) do
    [{pid, _}] = Registry.lookup(QuizworldRealtime.GameRegistry, ctx.pin)
    :ok = DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, pid)
    TestGameStore.delete_snapshot(ctx.pin)
    Games.create_session(%{ctx.attrs | "host_id" => "new", "quiz_id" => "new-private"})
  end

  test "old host channel closes on PIN reuse before forwarding replacement snapshots", ctx do
    {:ok, _, socket} =
      UserSocket
      |> socket("old", %{})
      |> subscribe_and_join(GameChannel, "game:" <> ctx.pin, %{"host_token" => ctx.host})

    monitor = Process.monitor(socket.channel_pid)
    {:ok, _, new_host} = replace(ctx)

    assert {:error, :invalid_token} =
             Games.authorized_snapshot(ctx.pin, %{"host_token" => ctx.host})

    {:ok, _, token, player} = Games.join_player(ctx.pin, %{"nickname" => "New private player"})
    {:ok, _, _, _} = Games.join_player(ctx.pin, %{"nickname" => "Pending"})
    {:ok, _} = Games.start_game(ctx.pin, new_host)
    {:ok, _} = Games.submit_answer(ctx.pin, player, token, "a", 0)
    assert_receive {:DOWN, ^monitor, :process, _, :normal}, 1000
    refute_push("session:update", %{session: %{quiz_id: "new-private"}}, 50)
  end

  test "stale cached host role cannot elevate a replacement player's command reply", ctx do
    {:ok, _, old_socket} =
      GameChannel.join(
        "game:" <> ctx.pin,
        %{"host_token" => ctx.host},
        socket(UserSocket, "old-direct", %{})
      )

    {:ok, _, new_host} = replace(ctx)
    {:ok, _, own_token, own} = Games.join_player(ctx.pin, %{"nickname" => "Own"})
    {:ok, _, other_token, other} = Games.join_player(ctx.pin, %{"nickname" => "Other"})
    {:ok, _, _, _} = Games.join_player(ctx.pin, %{"nickname" => "Pending"})
    {:ok, _} = Games.start_game(ctx.pin, new_host)
    {:ok, _} = Games.submit_answer(ctx.pin, other, other_token, "a", 0)

    assert {:reply, {:error, _}, _} =
             GameChannel.handle_in(
               "player:answer",
               %{"player_id" => own, "player_token" => own_token, "answer_id" => "a"},
               old_socket
             )
  end

  test "replacement during join-to-subscribe gap cannot promote an old host", ctx do
    {:ok, _, old_socket} =
      GameChannel.join(
        "game:" <> ctx.pin,
        %{"host_token" => ctx.host},
        socket(UserSocket, "gap", %{})
      )

    {:ok, replacement, _} = replace(ctx)

    assert {:reply, {:error, _}, _} =
             GameChannel.handle_in("player:join", %{"nickname" => "Stale host"}, old_socket)

    # Equivalent delayed delivery after subscription: the fence must be the
    # snapshot's atomically captured instance, not a later PIN lookup.
    assert {:stop, :normal, _} =
             GameChannel.handle_info({:host_session_updated, replacement}, old_socket)
  end
end
