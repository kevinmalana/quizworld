defmodule QuizworldRealtimeWeb.RepairChannelTest do
  use ExUnit.Case, async: false
  import Phoenix.ChannelTest
  @endpoint QuizworldRealtimeWeb.Endpoint
  alias QuizworldRealtime.Games
  alias QuizworldRealtimeWeb.{GameChannel, UserSocket}

  setup do
    QuizworldRealtime.TestGameStore.reset()
    :ok
  end

  for mode <- ["classic", "survival", "team"] do
    test "#{mode}: channel vote/reveal/finish/reconnect keeps poll neutral and final accuracy private" do
      pin = "R" <> Integer.to_string(System.unique_integer([:positive]))

      on_exit(fn ->
        for {pid, _} <- Registry.lookup(QuizworldRealtime.GameRegistry, pin) do
          DynamicSupervisor.terminate_child(QuizworldRealtime.GameSupervisor, pid)
        end
      end)

      {:ok, _, host_token} =
        Games.create_session(%{
          "pin" => pin,
          "host_id" => "fixture-host",
          "quiz_id" => "fixture-quiz",
          "game_mode" => unquote(mode),
          "questions" => [
            %{
              "id" => "poll",
              "text" => "Choose",
              "question_type" => "poll",
              "time_limit" => 60,
              "answers" => [%{"id" => "vote", "text" => "Vote", "is_correct" => false}]
            },
            %{
              "id" => "scored",
              "text" => "Correct?",
              "order_index" => 1,
              "time_limit" => 60,
              "answers" => [%{"id" => "right", "text" => "Right", "is_correct" => true}]
            }
          ]
        })

      {:ok, _, token, id} = Games.join_player(pin, %{"nickname" => "Fixture One"})
      {:ok, _, other_token, other_id} = Games.join_player(pin, %{"nickname" => "Fixture Two"})

      {:ok, _, socket} =
        UserSocket
        |> socket("fixture-player", %{})
        |> subscribe_and_join(GameChannel, "game:" <> pin, %{
          "player_id" => id,
          "player_token" => token
        })

      {:ok, _} = Games.start_game(pin, host_token)

      ref =
        push(socket, "player:answer", %{
          "player_id" => id,
          "player_token" => token,
          "answer_id" => "vote"
        })

      assert_reply(ref, :ok, %{session: %{status: "active"}})
      {:ok, _} = Games.submit_answer(pin, other_id, other_token, "vote", 0)
      assert_push("session:update", %{session: %{status: "reveal"} = poll})
      assert poll.eliminated == []
      assert poll.scored_question_count == 0
      assert poll.correct_counts == %{id => 0}
      assert [%{player_id: ^id, is_correct: nil, points_awarded: 0}] = poll.current_answers
      {:ok, _} = Games.advance(pin, host_token)

      ref =
        push(socket, "player:answer", %{
          "player_id" => id,
          "player_token" => token,
          "answer_id" => "right"
        })

      assert_reply(ref, :ok, %{session: %{status: "active"}})
      {:ok, _} = Games.submit_answer(pin, other_id, other_token, "right", 0)
      {:ok, _} = Games.advance(pin, host_token)
      assert_push("session:update", %{session: %{status: "finished"} = finished})
      assert finished.correct_counts == %{id => 1}
      assert finished.scored_question_count == 1
      refute Map.has_key?(finished, :question_history)
      assert Enum.all?(finished.current_answers, &(&1.player_id == id))

      {:ok, %{session: restored}, _} =
        UserSocket
        |> socket("reconnected-fixture", %{})
        |> subscribe_and_join(GameChannel, "game:" <> pin, %{
          "player_id" => id,
          "player_token" => token
        })

      assert restored.correct_counts == %{id => 1}
      refute Map.has_key?(restored, :question_history)

      # Real finished host join -> public HTTP fallback -> authenticated rejoin.
      {:ok, %{session: host_finished}, host_socket} =
        UserSocket
        |> socket("finished-host", %{})
        |> subscribe_and_join(GameChannel, "game:" <> pin, %{"host_token" => host_token})

      assert host_finished.correct_counts == %{id => 1, other_id => 1}
      assert length(host_finished.question_history) == 2
      Process.unlink(host_socket.channel_pid)
      close(host_socket)

      conn = Phoenix.ConnTest.build_conn()
      conn = Phoenix.ConnTest.dispatch(conn, @endpoint, :get, "/api/sessions/" <> pin)
      public = Phoenix.ConnTest.json_response(conn, 200)["session"]
      assert public["status"] == "finished"
      assert public["scored_question_count"] == 1
      refute Map.has_key?(public, "correct_counts")
      refute Map.has_key?(public, "question_history")
      refute Map.has_key?(public, "current_answers")

      {:ok, %{session: host_restored}, _} =
        UserSocket
        |> socket("reconnected-host", %{})
        |> subscribe_and_join(GameChannel, "game:" <> pin, %{"host_token" => host_token})

      assert host_restored.correct_counts == host_finished.correct_counts
      assert host_restored.question_history == host_finished.question_history
      assert host_restored.updated_at == host_finished.updated_at
    end
  end
end
