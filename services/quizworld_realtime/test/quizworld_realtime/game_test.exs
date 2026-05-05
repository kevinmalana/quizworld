defmodule QuizworldRealtime.GameTest do
  use ExUnit.Case, async: true

  alias QuizworldRealtime.Game

  defp two_questions do
    [
      %{
        "id" => "q1",
        "text" => "Which planet is known as the Red Planet?",
        "time_limit" => 20,
        "points" => 1000,
        "order_index" => 0,
        "answers" => [
          %{"id" => "a1", "text" => "Mercury", "is_correct" => false},
          %{"id" => "a2", "text" => "Mars", "is_correct" => true},
          %{"id" => "a3", "text" => "Venus", "is_correct" => false},
          %{"id" => "a4", "text" => "Jupiter", "is_correct" => false}
        ]
      },
      %{
        "id" => "q2",
        "text" => "What is the chemical symbol for water?",
        "time_limit" => 15,
        "points" => 800,
        "order_index" => 1,
        "answers" => [
          %{"id" => "b1", "text" => "H2O", "is_correct" => true},
          %{"id" => "b2", "text" => "CO2", "is_correct" => false},
          %{"id" => "b3", "text" => "O2", "is_correct" => false},
          %{"id" => "b4", "text" => "HO", "is_correct" => false}
        ]
      }
    ]
  end

  defp new_game(questions \\ nil) do
    Game.new(%{
      "pin" => "TEST01",
      "host_id" => "host_abc",
      "quiz_id" => "quiz_xyz",
      "questions" => questions || two_questions(),
      "game_mode" => "classic"
    })
  end

  defp join(game, nickname) do
    {:ok, game, token, id} = Game.join_player(game, %{"nickname" => nickname, "avatar" => "🦊"})
    {game, token, id}
  end

  test "join_player generates server-side player id" do
    game = new_game()
    {:ok, _game, _token, player_id} = Game.join_player(game, %{"nickname" => "Mia"})

    assert is_binary(player_id)
    assert String.starts_with?(player_id, "player_")
  end

  test "join_player rejects duplicate nicknames case-insensitively" do
    game = new_game()
    {:ok, game, _token, _id} = Game.join_player(game, %{"nickname" => "Mia"})

    assert {:error, :nickname_taken} =
             Game.join_player(game, %{"nickname" => "mia"})

    assert {:error, :nickname_taken} =
             Game.join_player(game, %{"nickname" => "MIA"})
  end

  test "join_player rejects blank nickname" do
    game = new_game()
    assert {:error, :invalid_player} = Game.join_player(game, %{"nickname" => "   "})
  end

  test "cannot start without players" do
    game = new_game()
    assert {:error, :no_players} = Game.start(game, Game.host_token(game))
  end

  test "cannot start with wrong host token" do
    game = new_game()
    {game, _token, _id} = join(game, "Mia")
    assert {:error, :not_host} = Game.start(game, "not_the_right_token")
  end

  test "game starts and status becomes active" do
    game = new_game()
    {game, _token, _id} = join(game, "Mia")
    {:ok, active} = Game.start(game, Game.host_token(game))

    assert active.status == "active"
    assert active.current_question_index == 0
    assert active.question_started_at != nil
  end

  test "advance moves to next question after reveal" do
    game = new_game()
    {game, _token, _id} = join(game, "Mia")
    {:ok, game} = Game.start(game, Game.host_token(game))
    {:ok, game} = Game.reveal_current_question(game, Game.host_token(game))
    {:ok, game} = Game.advance(game, Game.host_token(game))

    assert game.status == "active"
    assert game.current_question_index == 1
  end

  test "advance on last question finishes the game" do
    game = new_game()
    {game, _token, _id} = join(game, "Mia")
    {:ok, game} = Game.start(game, Game.host_token(game))
    {:ok, game} = Game.reveal_current_question(game, Game.host_token(game))
    {:ok, game} = Game.advance(game, Game.host_token(game))
    {:ok, game} = Game.reveal_current_question(game, Game.host_token(game))
    {:ok, finished} = Game.advance(game, Game.host_token(game))

    assert finished.status == "finished"
  end

  test "cannot advance without host token" do
    game = new_game()
    {game, _token, _id} = join(game, "Mia")
    {:ok, game} = Game.start(game, Game.host_token(game))
    {:ok, game} = Game.reveal_current_question(game, Game.host_token(game))

    assert {:error, :not_host} = Game.advance(game, "wrong_token")
  end

  test "active snapshot hides correct answers until reveal" do
    game = new_game()
    {game, _token, _id} = join(game, "Mia")
    {:ok, active} = Game.start(game, Game.host_token(game))

    snapshot = Game.snapshot(active)
    refute Enum.any?(snapshot.current_question["answers"], &Map.has_key?(&1, "is_correct"))

    {:ok, revealed} = Game.reveal_current_question(active, Game.host_token(active))
    rev_snapshot = Game.snapshot(revealed)
    assert Enum.any?(rev_snapshot.current_question["answers"], &Map.has_key?(&1, "is_correct"))
  end

  test "submit_answer rejects late answers" do
    game = new_game()
    {game, token, id} = join(game, "Mia")
    {:ok, active} = Game.start(game, Game.host_token(game))

    late_game = %{active | question_started_at: DateTime.add(DateTime.utc_now(), -25, :second)}

    assert {:error, :answer_window_closed} =
             Game.submit_answer(late_game, id, token, "a2", 24_000)
  end

  test "cannot answer twice" do
    game = new_game()
    {game, token, id} = join(game, "Mia")
    {:ok, game} = Game.start(game, Game.host_token(game))
    {:ok, game} = Game.submit_answer(game, id, token, "a2", 2_000)

    assert {:error, :already_answered} =
             Game.submit_answer(game, id, token, "a2", 3_000)
  end

  test "cannot answer with wrong player token" do
    game = new_game()
    {game, _token, id} = join(game, "Mia")
    {:ok, game} = Game.start(game, Game.host_token(game))

    assert {:error, :invalid_player_token} =
             Game.submit_answer(game, id, "bad_token", "a2", 1_000)
  end

  test "reveal scores correct answers and gives zero for incorrect" do
    game = new_game()
    {game, token_mia, id_mia} = join(game, "Mia")
    {game, token_bob, id_bob} = join(game, "Bob")

    {:ok, game} = Game.start(game, Game.host_token(game))
    {:ok, game} = Game.submit_answer(game, id_mia, token_mia, "a2", 2_000)
    {:ok, game} = Game.submit_answer(game, id_bob, token_bob, "a1", 1_000)

    {:ok, revealed} = Game.reveal_current_question(game, Game.host_token(game))
    snapshot = Game.snapshot(revealed)

    mia = Enum.find(snapshot.players, &(&1.nickname == "Mia"))
    bob = Enum.find(snapshot.players, &(&1.nickname == "Bob"))

    assert mia.score > 0
    assert bob.score == 0

    mia_answer = Enum.find(snapshot.current_answers, &(&1.player_id == id_mia))
    bob_answer = Enum.find(snapshot.current_answers, &(&1.player_id == id_bob))

    assert mia_answer.is_correct == true
    assert mia_answer.points_awarded > 0
    assert bob_answer.is_correct == false
    assert bob_answer.points_awarded == 0
  end

  test "faster correct answers earn more points" do
    game = new_game()
    {game, token_fast, id_fast} = join(game, "Fast")
    {game, token_slow, id_slow} = join(game, "Slow")

    {:ok, game} = Game.start(game, Game.host_token(game))
    {:ok, game} = Game.submit_answer(game, id_fast, token_fast, "a2", 1_000)
    {:ok, game} = Game.submit_answer(game, id_slow, token_slow, "a2", 18_000)

    {:ok, revealed} = Game.reveal_current_question(game, Game.host_token(game))
    snapshot = Game.snapshot(revealed)

    fast = Enum.find(snapshot.players, &(&1.nickname == "Fast"))
    slow = Enum.find(snapshot.players, &(&1.nickname == "Slow"))

    assert fast.score > slow.score
  end

  test "reconnect_player succeeds with valid token and returns current snapshot" do
    game = new_game()
    {game, token, id} = join(game, "Mia")
    {:ok, active} = Game.start(game, Game.host_token(game))

    assert {:ok, snapshot} = Game.reconnect_player(active, id, token)
    assert snapshot.status == "active"
  end

  test "reconnect_player fails with wrong token" do
    game = new_game()
    {game, _token, id} = join(game, "Mia")

    assert {:error, :invalid_player_token} =
             Game.reconnect_player(game, id, "wrong_token")
  end

  test "reconnect_player fails for unknown player" do
    game = new_game()

    assert {:error, :unknown_player} =
             Game.reconnect_player(game, "player_nobody", "any_token")
  end

  test "game_mode is stored in snapshot" do
    game = new_game()
    snapshot = Game.snapshot(game)
    assert snapshot.game_mode == "classic"
  end
end
