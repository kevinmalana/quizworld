# Pure Game -> ResultSync fixtures: no application, persistence or network calls.
# The TS bridge first compiles current sources with MIX_ENV=test mix compile.
alias QuizworldRealtime.{Game, ResultSync}

fixtures =
  for mode <- ["classic", "survival", "team"], mixed <- [false, true] do
    poll = %{
      "id" => "poll",
      "text" => "Preference?",
      "question_type" => "poll",
      "answers" => [%{"id" => "vote", "text" => "Vote", "is_correct" => true}]
    }

    scored = %{
      "id" => "scored",
      "text" => "Knowledge?",
      "order_index" => 1,
      "answers" => [%{"id" => "right", "text" => "Right", "is_correct" => true}]
    }

    game =
      Game.new(%{
        "pin" => "123456",
        "host_id" => "host",
        "quiz_id" => "quiz",
        "game_mode" => mode,
        "questions" => if(mixed, do: [poll, scored], else: [poll])
      })

    {:ok, game, token, id} = Game.join_player(game, %{"nickname" => "Voter"})
    {:ok, game, _, _} = Game.join_player(game, %{"nickname" => "Non-voter"})
    {:ok, game} = Game.start(game, game.host_token)
    {:ok, game} = Game.submit_answer(game, id, token, "vote", 0)
    {:ok, game} = Game.reveal_current_question(game, game.host_token)
    {:ok, game} = Game.advance(game, game.host_token)

    game =
      if mixed do
        {:ok, game} = Game.submit_answer(game, id, token, "right", 0)
        {:ok, game} = Game.reveal_current_question(game, game.host_token)
        {:ok, game} = Game.advance(game, game.host_token)
        game
      else
        game
      end

    {:ok, payload} = ResultSync.build_result_payload(game)

    %{
      mode: mode,
      mixed: mixed,
      player_id: id,
      payload: payload,
      host: Game.snapshot(game),
      public: Game.snapshot_for_role(Game.snapshot(game), :public),
      player: Game.snapshot_for_role(Game.snapshot(game), {:player, id})
    }
  end

IO.puts(Jason.encode!(fixtures))
