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

  test "submit_answer derives response time from the server clock" do
    game = new_game()
    {game, token, id} = join(game, "Mia")
    {:ok, active} = Game.start(game, Game.host_token(game))
    started_five_seconds_ago = DateTime.add(DateTime.utc_now(), -5, :second)

    assert {:ok, answered} =
             Game.submit_answer(
               %{active | question_started_at: started_five_seconds_ago},
               id,
               token,
               "a2",
               0
             )

    response_time = answered.answers["q1"][id].response_time_ms
    assert response_time >= 4_900
    assert response_time <= 5_500
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
    fast_started_at = DateTime.add(DateTime.utc_now(), -1, :second)

    {:ok, game} =
      Game.submit_answer(
        %{game | question_started_at: fast_started_at},
        id_fast,
        token_fast,
        "a2",
        99_000
      )

    slow_started_at = DateTime.add(DateTime.utc_now(), -18, :second)

    {:ok, game} =
      Game.submit_answer(
        %{game | question_started_at: slow_started_at},
        id_slow,
        token_slow,
        "a2",
        0
      )

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

    # ensure_player_token checks token validity first, so a fake token
    # on an unknown player returns :invalid_player_token (not :unknown_player)
    assert {:error, :invalid_player_token} =
             Game.reconnect_player(game, "player_nobody", "any_token")
  end

  test "ready_player publishes readiness in the shared lobby snapshot" do
    game = new_game()
    {game, token, id} = join(game, "Mia")

    assert {:ok, ready_game} = Game.ready_player(game, id, token)
    assert Game.snapshot(ready_game).ready_player_ids == [id]
  end

  test "game_mode is stored in snapshot" do
    game = new_game()
    snapshot = Game.snapshot(game)
    assert snapshot.game_mode == "classic"
  end

  # ─── Survival Mode Tests ─────────────────────────────────────────────────────

  defp survival_game do
    Game.new(%{
      "pin" => "SURV01",
      "host_id" => "host_abc",
      "quiz_id" => "quiz_xyz",
      "questions" => two_questions(),
      "game_mode" => "survival"
    })
  end

  defp start_game_with_players(game, nicknames) do
    game_with_players =
      Enum.reduce(nicknames, game, fn nick, g ->
        {:ok, g2, _token, _id} = Game.join_player(g, %{"nickname" => nick, "avatar" => "🦊"})
        g2
      end)

    host_token = Game.host_token(game_with_players)
    {:ok, started} = Game.start(game_with_players, host_token)
    {started, host_token}
  end

  test "survival: normalize_game_mode stores 'survival'" do
    game = survival_game()
    assert game.game_mode == "survival"
  end

  test "survival: snapshot exposes eliminated list (empty initially)" do
    game = survival_game()
    snapshot = Game.snapshot(game)
    assert snapshot.eliminated == []
    assert snapshot.alive_count == 0
  end

  test "survival: wrong answer eliminates player on reveal" do
    game = survival_game()
    {started, host_token} = start_game_with_players(game, ["Alice", "Bob"])

    player_ids = Map.keys(started.players)
    [pid_a, pid_b] = player_ids

    p_token_a = Map.get(started.players, pid_a).player_token
    p_token_b = Map.get(started.players, pid_b).player_token

    # Both answer wrong (a3 = Venus = incorrect for q1)
    {:ok, after_a} = Game.submit_answer(started, pid_a, p_token_a, "a3", 1000)
    {:ok, after_both} = Game.submit_answer(after_a, pid_b, p_token_b, "a3", 1000)

    {:ok, revealed} = Game.reveal_current_question(after_both, host_token)

    # Both should be eliminated
    assert MapSet.size(revealed.eliminated) == 2
    snapshot = Game.snapshot(revealed)
    assert length(snapshot.eliminated) == 2
    assert snapshot.alive_count == 0
  end

  test "survival: correct answer does NOT eliminate player" do
    game = survival_game()
    {started, host_token} = start_game_with_players(game, ["Alice", "Bob"])

    player_ids = Map.keys(started.players)
    [pid_a | _] = player_ids
    p_token_a = Map.get(started.players, pid_a).player_token

    # Alice answers correctly (a2 = Mars)
    {:ok, after_a} = Game.submit_answer(started, pid_a, p_token_a, "a2", 1000)
    {:ok, revealed} = Game.reveal_current_question(after_a, host_token)

    refute MapSet.member?(revealed.eliminated, pid_a)
  end

  test "survival: eliminated player cannot submit answer" do
    # 3 players: after round, Bob survives alone but game ends since alive<=1
    # Use a 3-question game to test: Alice eliminated Q1, tries Q2
    game3 =
      Game.new(%{
        "pin" => "SURV03",
        "host_id" => "host_abc",
        "quiz_id" => "quiz_xyz",
        "game_mode" => "survival",
        "questions" =>
          two_questions() ++
            [
              %{
                "id" => "q3",
                "text" => "Q3",
                "time_limit" => 20,
                "points" => 1000,
                "order_index" => 2,
                "answers" => [
                  %{"id" => "c1", "text" => "Yes", "is_correct" => true},
                  %{"id" => "c2", "text" => "No", "is_correct" => false}
                ]
              }
            ]
      })

    {started, host_token} = start_game_with_players(game3, ["Alice", "Bob", "Charlie"])

    player_ids = Map.keys(started.players)
    [pid_a | rest] = player_ids
    [pid_b | _] = rest
    p_token_a = Map.get(started.players, pid_a).player_token
    p_token_b = Map.get(started.players, pid_b).player_token

    # Get Charlie's pid too
    [pid_c | _] = Enum.reject(player_ids, fn p -> p == pid_a or p == pid_b end)
    p_token_c = Map.get(started.players, pid_c).player_token

    # Round 1: Alice wrong, Bob + Charlie correct → only Alice eliminated, 2 alive
    {:ok, g1} = Game.submit_answer(started, pid_a, p_token_a, "a3", 500)
    {:ok, g2} = Game.submit_answer(g1, pid_b, p_token_b, "a2", 500)
    {:ok, g3} = Game.submit_answer(g2, pid_c, p_token_c, "a2", 500)
    {:ok, revealed} = Game.reveal_current_question(g3, host_token)
    {:ok, next} = Game.advance(revealed, host_token)

    # 2 players alive (Bob + Charlie), game continues
    assert next.status == "active"
    result = Game.submit_answer(next, pid_a, p_token_a, "b2", 500)
    assert {:error, :eliminated} = result
  end

  test "survival: game ends when 1 player alive after advance" do
    game = survival_game()
    {started, host_token} = start_game_with_players(game, ["Alice", "Bob"])

    player_ids = Map.keys(started.players)
    [pid_a, pid_b] = player_ids
    p_token_a = Map.get(started.players, pid_a).player_token
    p_token_b = Map.get(started.players, pid_b).player_token

    # Alice wrong, Bob correct on q1
    {:ok, g1} = Game.submit_answer(started, pid_a, p_token_a, "a3", 500)
    {:ok, g2} = Game.submit_answer(g1, pid_b, p_token_b, "a2", 500)
    {:ok, revealed} = Game.reveal_current_question(g2, host_token)

    # 1 player alive — advance should end game immediately
    {:ok, finished} = Game.advance(revealed, host_token)
    assert finished.status == "finished"
  end

  test "survival: all eliminated → game ends on advance" do
    game = survival_game()
    {started, host_token} = start_game_with_players(game, ["Alice", "Bob"])

    player_ids = Map.keys(started.players)
    [pid_a, pid_b] = player_ids
    p_token_a = Map.get(started.players, pid_a).player_token
    p_token_b = Map.get(started.players, pid_b).player_token

    # Both wrong on q1 — all eliminated
    {:ok, g1} = Game.submit_answer(started, pid_a, p_token_a, "a3", 500)
    {:ok, g2} = Game.submit_answer(g1, pid_b, p_token_b, "a3", 500)
    {:ok, revealed} = Game.reveal_current_question(g2, host_token)
    {:ok, finished} = Game.advance(revealed, host_token)

    assert finished.status == "finished"
  end

  # ─── Team Battle Mode Tests ──────────────────────────────────────────────────

  defp team_game do
    Game.new(%{
      "pin" => "TEAM01",
      "host_id" => "host_abc",
      "quiz_id" => "quiz_xyz",
      "questions" => two_questions(),
      "game_mode" => "team"
    })
  end

  test "team: normalize_game_mode stores 'team'" do
    game = team_game()
    assert game.game_mode == "team"
  end

  test "team: teams empty before game starts" do
    game = team_game()
    assert game.teams == %{}
    assert game.team_assignments == %{}
  end

  test "team: teams assigned on game start" do
    game = team_game()
    {started, _host_token} = start_game_with_players(game, ["Alice", "Bob", "Charlie"])

    # 3 players → 2 teams
    assert map_size(started.teams) == 2
    assert map_size(started.team_assignments) == 3

    # All players assigned
    player_ids = Map.keys(started.players)
    assert Enum.all?(player_ids, fn pid -> Map.has_key?(started.team_assignments, pid) end)
  end

  test "team: 8 players get 3 teams" do
    game = team_game()
    nicks = ["A", "B", "C", "D", "E", "F", "G", "H"]
    {started, _} = start_game_with_players(game, nicks)
    assert map_size(started.teams) == 3
  end

  test "team: 16+ players get 4 teams" do
    game = team_game()
    nicks = Enum.map(1..16, &"Player#{&1}")
    {started, _} = start_game_with_players(game, nicks)
    assert map_size(started.teams) == 4
  end

  test "team: team scores aggregate from player answers" do
    game = team_game()
    {started, host_token} = start_game_with_players(game, ["Alice", "Bob"])

    # Alice and Bob are on different teams (round-robin: alice=red, bob=blue)
    player_ids = Map.keys(started.players)
    [pid_a, pid_b] = player_ids
    p_token_a = Map.get(started.players, pid_a).player_token
    p_token_b = Map.get(started.players, pid_b).player_token

    # Alice correct, Bob wrong
    {:ok, g1} = Game.submit_answer(started, pid_a, p_token_a, "a2", 500)
    {:ok, g2} = Game.submit_answer(g1, pid_b, p_token_b, "a3", 500)
    {:ok, revealed} = Game.reveal_current_question(g2, host_token)

    # Alice's team should have points, Bob's team should have 0
    alice_team_id = Map.get(revealed.team_assignments, pid_a)
    bob_team_id = Map.get(revealed.team_assignments, pid_b)

    alice_team_score = get_in(revealed.teams, [alice_team_id, :score])
    bob_team_score = get_in(revealed.teams, [bob_team_id, :score])

    assert alice_team_score > 0
    assert bob_team_score == 0
  end

  test "team: snapshot exposes teams and team_assignments" do
    game = team_game()
    {started, _} = start_game_with_players(game, ["Alice", "Bob"])
    snapshot = Game.snapshot(started)

    assert is_map(snapshot.teams)
    assert is_map(snapshot.team_assignments)
    assert map_size(snapshot.teams) == 2
  end

  test "team: elimination does not apply (team mode uses classic elimination = MapSet.new)" do
    game = team_game()
    {started, host_token} = start_game_with_players(game, ["Alice", "Bob"])

    player_ids = Map.keys(started.players)
    [pid_a, pid_b] = player_ids
    p_token_a = Map.get(started.players, pid_a).player_token
    p_token_b = Map.get(started.players, pid_b).player_token

    # Both wrong
    {:ok, g1} = Game.submit_answer(started, pid_a, p_token_a, "a3", 500)
    {:ok, g2} = Game.submit_answer(g1, pid_b, p_token_b, "a3", 500)
    {:ok, revealed} = Game.reveal_current_question(g2, host_token)

    # Team mode: no one eliminated
    assert MapSet.size(revealed.eliminated) == 0
  end
end
