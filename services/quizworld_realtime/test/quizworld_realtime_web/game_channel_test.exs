defmodule QuizworldRealtimeWeb.GameChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest

  @endpoint QuizworldRealtimeWeb.Endpoint

  alias QuizworldRealtime.Games
  alias QuizworldRealtimeWeb.GameChannel
  alias QuizworldRealtimeWeb.UserSocket

  setup do
    QuizworldRealtime.TestGameStore.reset()
    pin = "W" <> Integer.to_string(System.unique_integer([:positive]))

    {:ok, _, host_token} =
      Games.create_session(%{
        "pin" => pin,
        "host_id" => "host",
        "quiz_id" => "quiz",
        "questions" => [
          %{
            "id" => "q1",
            "text" => "Question?",
            "time_limit" => 20,
            "points" => 1_000,
            "order_index" => 0,
            "answers" => [
              %{"id" => "a1", "text" => "Yes", "is_correct" => true},
              %{"id" => "a2", "text" => "No", "is_correct" => false}
            ]
          }
        ]
      })

    %{pin: pin, host_token: host_token}
  end

  test "presence updates do not crash connected game channels", %{pin: pin} do
    {:ok, _, first_socket} =
      UserSocket
      |> socket("first", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{})

    {:ok, _, second_socket} =
      UserSocket
      |> socket("second", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{})

    Process.sleep(50)

    assert Process.alive?(first_socket.channel_pid)
    assert Process.alive?(second_socket.channel_pid)
  end

  test "a host who is also playing receives a host-shaped answer reply", %{
    pin: pin,
    host_token: host_token
  } do
    assert {:ok, _, player_token, player_id} =
             Games.join_player(pin, %{"nickname" => "Host Player"})

    assert {:ok, _} = Games.start_game(pin, host_token)

    {:ok, _, socket} =
      UserSocket
      |> socket("host-player", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{
        "host_token" => host_token,
        "player_id" => player_id,
        "player_token" => player_token
      })

    ref =
      push(socket, "player:answer", %{
        "player_id" => player_id,
        "player_token" => player_token,
        "answer_id" => "a1",
        "response_time_ms" => 100
      })

    assert_reply(ref, :ok, %{session: session})
    assert [%{player_id: ^player_id}] = session.current_answers
    assert Map.has_key?(session, :question_history)
  end

  test "a player sees no result while active and receives their result at reveal", %{
    pin: pin,
    host_token: host_token
  } do
    assert {:ok, _, token_one, player_one} = Games.join_player(pin, %{"nickname" => "One"})
    assert {:ok, _, token_two, player_two} = Games.join_player(pin, %{"nickname" => "Two"})
    assert {:ok, _} = Games.start_game(pin, host_token)

    {:ok, _, socket} =
      UserSocket
      |> socket("player-one", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{
        "player_id" => player_one,
        "player_token" => token_one
      })

    ref =
      push(socket, "player:answer", %{
        "player_id" => player_one,
        "player_token" => token_one,
        "answer_id" => "a1",
        "response_time_ms" => 100
      })

    assert_reply(ref, :ok, %{session: %{status: "active", current_answers: [active_answer]}})
    refute Map.has_key?(active_answer, :is_correct)
    refute Map.has_key?(active_answer, :points_awarded)

    assert {:ok, %{status: "reveal"}} =
             Games.submit_answer(pin, player_two, token_two, "a2", 100)

    assert_push("session:update", %{session: %{status: "reveal", current_answers: [result]}})
    assert result.player_id == player_one
    assert result.is_correct == true
    assert is_integer(result.points_awarded)
  end

  test "a channel cannot switch to a second player identity", %{pin: pin} do
    {:ok, _, socket} =
      UserSocket
      |> socket("joining-player", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{})

    first_ref = push(socket, "player:join", %{"nickname" => "One"})
    assert_reply(first_ref, :ok, %{player_id: first_player_id})

    second_ref = push(socket, "player:join", %{"nickname" => "Two"})
    assert_reply(second_ref, :error, %{reason: "already_joined"})

    assert {:ok, snapshot} = Games.snapshot(pin)
    assert Enum.map(snapshot.players, & &1.id) == [first_player_id]
  end

  test "host channels forward only the host-shaped update", %{pin: pin, host_token: host_token} do
    assert {:ok, _, _player_token, _player_id} =
             Games.join_player(pin, %{"nickname" => "Player"})

    {:ok, _, _socket} =
      UserSocket
      |> socket("host", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{"host_token" => host_token})

    assert {:ok, _} = Games.start_game(pin, host_token)
    assert_push("session:update", %{session: host_session})
    assert Map.has_key?(host_session, :current_answers)
    assert Map.has_key?(host_session, :question_history)
    refute_push("session:update", _payload, 50)
  end

  test "a host becoming a player keeps exactly one host update subscription", %{
    pin: pin,
    host_token: host_token
  } do
    {:ok, _, socket} =
      UserSocket
      |> socket("host-player-transition", %{})
      |> subscribe_and_join(GameChannel, "game:" <> pin, %{"host_token" => host_token})

    join_ref = push(socket, "player:join", %{"nickname" => "Host Player"})
    assert_reply(join_ref, :ok, %{player_id: _player_id})
    assert_push("session:update", %{session: joined_session})
    assert Map.has_key?(joined_session, :current_answers)

    assert {:ok, _} = Games.start_game(pin, host_token)
    assert_push("session:update", %{session: active_session})
    assert active_session.status == "active"
    assert Map.has_key?(active_session, :current_answers)
    refute_push("session:update", _payload, 50)
  end
end
