defmodule QuizworldRealtime.Game do
  @enforce_keys [:pin, :host_id, :host_token, :quiz_id, :questions, :created_at, :updated_at]
  defstruct [
    :pin,
    :instance_id,
    :host_id,
    :host_token,
    :quiz_id,
    :category,
    :created_at,
    :updated_at,
    :game_mode,
    :question_timer_ref,
    :cleanup_timer_ref,
    status: "waiting",
    current_question_index: -1,
    question_started_at: nil,
    players: %{},
    questions: [],
    answers: %{},
    # Survival mode: set of eliminated player_ids
    eliminated: MapSet.new(),
    # Team Battle mode: teams map + player→team assignments
    teams: %{},
    team_assignments: %{}
  ]

  @max_players 200

  def new(attrs) do
    now = DateTime.utc_now()

    %__MODULE__{
      pin: fetch_string(attrs, "pin"),
      instance_id: Map.get(attrs, "instance_id") || token(),
      host_id: fetch_string(attrs, "host_id"),
      host_token: token(),
      quiz_id: fetch_string(attrs, "quiz_id"),
      category: normalize_category(Map.get(attrs, "category")),
      questions: normalize_questions(Map.get(attrs, "questions", [])),
      game_mode: normalize_game_mode(Map.get(attrs, "game_mode")),
      created_at: now,
      updated_at: now,
      question_timer_ref: nil,
      cleanup_timer_ref: nil
    }
  end

  def snapshot(%__MODULE__{} = game) do
    current_question = current_question(game)
    current_question_id = if current_question, do: current_question["id"], else: nil
    current_answers = Map.get(game.answers, current_question_id, %{})

    players =
      game.players
      |> Map.values()
      |> Enum.map(&Map.drop(&1, [:player_token]))
      |> Enum.sort_by(& &1.joined_at, fn left, right ->
        DateTime.compare(left, right) != :gt
      end)

    question_with_counts =
      if current_question do
        %{
          public_question(current_question, game.status)
          | "answers" =>
              Enum.map(current_question["answers"], fn answer ->
                count =
                  current_answers
                  |> Map.values()
                  |> Enum.count(&(&1.answer_id == answer["id"]))

                answer
                |> public_answer(game.status)
                |> Map.put("count", count)
              end)
        }
      else
        nil
      end

    # Build question history for host analytics
    question_history =
      game.questions
      |> Enum.with_index()
      |> Enum.filter(fn {_q, idx} -> idx < game.current_question_index end)
      |> Enum.map(fn {question, idx} ->
        question_answers = Map.get(game.answers, question["id"], %{})
        correct_answer = Enum.find(question["answers"] || [], &Map.get(&1, "is_correct", false))

        %{
          "index" => idx,
          "text" => question["text"],
          "correct_answer_id" => if(correct_answer, do: correct_answer["id"], else: nil),
          "correct_answer_text" => if(correct_answer, do: correct_answer["text"], else: nil),
          "time_limit" => question["time_limit"],
          "points" => question["points"],
          "responses" =>
            question_answers
            |> Enum.map(fn {pid, row} ->
              player = Map.get(game.players, pid)

              %{
                "player_id" => pid,
                "nickname" => if(player, do: player.nickname, else: "Unknown"),
                "avatar" => if(player, do: Map.get(player, :avatar), else: nil),
                "answer_id" => row.answer_id,
                "is_correct" => row.is_correct,
                "points_awarded" => row.points_awarded,
                "response_time_ms" => row.response_time_ms
              }
            end)
        }
      end)

    %{
      pin: game.pin,
      quiz_id: game.quiz_id,
      category: game.category,
      game_mode: game.game_mode || "classic",
      quiz: %{
        id: game.quiz_id,
        category: game.category,
        questions:
          Enum.map(game.questions, fn question ->
            %{
              "id" => question["id"],
              "order_index" => question["order_index"]
            }
          end)
      },
      status: game.status,
      current_question_index: game.current_question_index,
      question_started_at: game.question_started_at,
      created_at: game.created_at,
      updated_at: game.updated_at,
      players: players,
      current_question: question_with_counts,
      current_answers:
        current_answers
        |> Map.values()
        |> Enum.map(
          &Map.take(&1, [:player_id, :answer_id, :response_time_ms, :is_correct, :points_awarded])
        ),
      question_history: question_history,
      # Survival mode
      eliminated: MapSet.to_list(game.eliminated),
      alive_count: map_size(game.players) - MapSet.size(game.eliminated),
      # Team Battle mode
      teams: game.teams,
      team_assignments: game.team_assignments
    }
  end

  def host_token(%__MODULE__{} = game), do: game.host_token

  def join_player(%__MODULE__{status: status}, _attrs) when status != "waiting" do
    {:error, :session_closed}
  end

  def join_player(%__MODULE__{players: players}, _attrs)
      when map_size(players) >= @max_players do
    {:error, :game_full}
  end

  def join_player(%__MODULE__{} = game, attrs) do
    nickname = normalize_nickname(Map.get(attrs, "nickname"))

    cond do
      nickname == "" ->
        {:error, :invalid_player}

      nickname_taken?(game, nickname) ->
        {:error, :nickname_taken}

      true ->
        player_token = token()
        new_player_id = player_id()

        player = %{
          id: new_player_id,
          nickname: nickname,
          avatar: blank_to_nil(Map.get(attrs, "avatar")),
          score: 0,
          player_token: player_token,
          joined_at: DateTime.utc_now()
        }

        {:ok, touch(%{game | players: Map.put(game.players, new_player_id, player)}),
         player_token, new_player_id}
    end
  end

  def start(%__MODULE__{} = game, host_token) do
    cond do
      host_token != game.host_token ->
        {:error, :not_host}

      game.status != "waiting" ->
        {:ok, game}

      game.questions == [] ->
        {:error, :no_questions}

      map_size(game.players) == 0 ->
        {:error, :no_players}

      true ->
        game_with_mode = init_game_mode(game)
        {:ok,
         touch(%{
           game_with_mode
           | status: "active",
             current_question_index: 0,
             question_started_at: DateTime.utc_now()
         })}
    end
  end

  # Initialise mode-specific state when the game starts
  defp init_game_mode(%__MODULE__{game_mode: "team"} = game) do
    player_ids = Map.keys(game.players)
    assign_teams(game, player_ids)
  end

  defp init_game_mode(%__MODULE__{} = game), do: game

  # Assign players to 2-4 balanced teams by round-robin
  defp assign_teams(%__MODULE__{} = game, player_ids) do
    team_defs = [
      %{id: "red",    name: "Red Team",    color: "#ef4444", emoji: "🔴"},
      %{id: "blue",   name: "Blue Team",   color: "#3b82f6", emoji: "🔵"},
      %{id: "green",  name: "Green Team",  color: "#22c55e", emoji: "🟢"},
      %{id: "yellow", name: "Yellow Team", color: "#eab308", emoji: "🟡"}
    ]

    # Use 2 teams for small games (<8 players), up to 4 for larger
    team_count = cond do
      length(player_ids) >= 16 -> 4
      length(player_ids) >= 8  -> 3
      true                     -> 2
    end

    active_teams = Enum.take(team_defs, team_count)

    teams = Enum.into(active_teams, %{}, fn t ->
      {t.id, Map.put(t, :score, 0)}
    end)

    team_assignments = player_ids
      |> Enum.with_index()
      |> Enum.into(%{}, fn {pid, idx} ->
        team = Enum.at(active_teams, rem(idx, team_count))
        {pid, team.id}
      end)

    %{game | teams: teams, team_assignments: team_assignments}
  end

  def submit_answer(%__MODULE__{} = game, player_id, player_token, answer_id, _client_response_time_ms) do
    with :ok <- ensure_active(game),
         :ok <- ensure_not_eliminated(game, player_id),
         :ok <- ensure_player_token(game, player_id, player_token),
         {:ok, question} <- fetch_current_question(game),
         :ok <- ensure_answer_window_open(game, question),
         :ok <- ensure_answer_belongs_to_question(question, answer_id),
         :ok <- ensure_not_answered(game, question["id"], player_id) do
      response_time_ms =
        case game.question_started_at do
          %DateTime{} = started_at ->
            max(DateTime.diff(DateTime.utc_now(), started_at, :millisecond), 0)

          _ ->
            0
        end

      answer_row = %{
        player_id: player_id,
        answer_id: answer_id,
        response_time_ms: response_time_ms,
        submitted_at: DateTime.utc_now(),
        is_correct: false,
        points_awarded: 0
      }

      next_answers =
        Map.update(
          game.answers,
          question["id"],
          %{player_id => answer_row},
          fn question_answers ->
            Map.put(question_answers, player_id, answer_row)
          end
        )

      {:ok, touch(%{game | answers: next_answers})}
    end
  end

  def reveal_current_question(%__MODULE__{} = game, host_token) do
    with :ok <- ensure_host(game, host_token),
         :ok <- ensure_status(game, "active"),
         {:ok, question} <- fetch_current_question(game) do
      total_time_ms = max(Map.get(question, "time_limit", 20), 1) * 1000

      # 2026-08-13: Defensive — if a question has no `is_correct` answer
      # (malformed import, broken data, etc.), score the round with
      # `correct_answer_id = nil`. Previously, `Map.fetch!("id")` would raise,
      # crash the GenServer, force a DynamicSupervisor restart, and disconnect
      # all live players. Now we fail the reveal gracefully.
      correct_answer =
        question["answers"]
        |> Enum.find(fn answer -> Map.get(answer, "is_correct", false) end)

      correct_answer_id =
        case correct_answer do
          nil -> nil
          answer -> answer["id"]
        end

      if correct_answer_id == nil do
        require Logger
        Logger.warning(
          "[Game #{game.pin}] Question " <>
            "#{question["id"] || "?"} has no is_correct answer; " <>
            "scoring skipped for this round"
        )
      end

      scored_rows =
        game.answers
        |> Map.get(question["id"], %{})
        |> Enum.into(%{}, fn {pid, row} ->
          # Eliminated players (survival) get 0 points but still recorded
          already_eliminated = MapSet.member?(game.eliminated, pid)
          is_correct = !already_eliminated and row.answer_id == correct_answer_id

          points_awarded =
            if is_correct do
              scaled =
                Map.get(question, "points", 1000) *
                  (0.5 +
                     0.5 *
                       max(
                         0.0,
                         1.0 - row.response_time_ms / total_time_ms
                       ))

              round(scaled)
            else
              0
            end

          {pid,
           row
           |> Map.put(:is_correct, is_correct)
           |> Map.put(:points_awarded, points_awarded)}
        end)

      # Update individual player scores
      next_players =
        Enum.reduce(game.players, %{}, fn {pid, player}, acc ->
          scored_points =
            scored_rows
            |> Map.get(pid, %{points_awarded: 0})
            |> Map.get(:points_awarded, 0)

          Map.put(acc, pid, %{player | score: player.score + scored_points})
        end)

      # Survival: eliminate players who answered wrong (or didn't answer)
      next_eliminated =
        if game.game_mode == "survival" do
          alive_pids = Map.keys(game.players) |> Enum.reject(&MapSet.member?(game.eliminated, &1))
          newly_eliminated = Enum.filter(alive_pids, fn pid ->
            row = Map.get(scored_rows, pid)
            row == nil or !row.is_correct
          end)
          MapSet.union(game.eliminated, MapSet.new(newly_eliminated))
        else
          game.eliminated
        end

      # Team Battle: aggregate team scores from player scores this round
      next_teams =
        if game.game_mode == "team" and map_size(game.teams) > 0 do
          round_points_by_team =
            Enum.reduce(scored_rows, %{}, fn {pid, row}, acc ->
              team_id = Map.get(game.team_assignments, pid)
              if team_id do
                Map.update(acc, team_id, row.points_awarded, &(&1 + row.points_awarded))
              else
                acc
              end
            end)

          Enum.into(game.teams, %{}, fn {tid, team} ->
            round_pts = Map.get(round_points_by_team, tid, 0)
            {tid, %{team | score: team.score + round_pts}}
          end)
        else
          game.teams
        end

      {:ok,
       touch(%{
         game
         | status: "reveal",
           players: next_players,
           eliminated: next_eliminated,
           teams: next_teams,
           answers: Map.put(game.answers, question["id"], scored_rows)
       })}
    end
  end

  def reconnect_player(%__MODULE__{} = game, player_id, player_token) do
    with :ok <- ensure_player_token(game, player_id, player_token) do
      {:ok, snapshot(game)}
    end
  end

  def advance(%__MODULE__{} = game, host_token) do
    with :ok <- ensure_host(game, host_token),
         :ok <- ensure_status(game, "reveal") do
      last_question_index = length(game.questions) - 1

      # Survival: end game if fewer than 2 players remain alive
      # (need at least 2 alive to keep competing — 1 remaining = that player wins)
      alive_count =
        if game.game_mode == "survival" do
          game.players
          |> Map.keys()
          |> Enum.reject(&MapSet.member?(game.eliminated, &1))
          |> length()
        else
          999
        end

      if game.current_question_index >= last_question_index or
           (game.game_mode == "survival" and alive_count < 2) do
        {:ok, touch(%{game | status: "finished", question_started_at: nil})}
      else
        {:ok,
         touch(%{
           game
           | status: "active",
             current_question_index: game.current_question_index + 1,
             question_started_at: DateTime.utc_now()
         })}
      end
    end
  end

  def with_question_timer_ref(%__MODULE__{} = game, timer_ref) do
    %{game | question_timer_ref: timer_ref}
  end

  def with_cleanup_timer_ref(%__MODULE__{} = game, timer_ref) do
    %{game | cleanup_timer_ref: timer_ref}
  end

  def for_persistence(%__MODULE__{} = game) do
    %{game | question_timer_ref: nil, cleanup_timer_ref: nil}
  end

  defp current_question(%__MODULE__{current_question_index: index, questions: questions})
       when index >= 0 do
    Enum.at(questions, index)
  end

  defp current_question(_), do: nil

  defp fetch_current_question(game) do
    case current_question(game) do
      nil -> {:error, :no_current_question}
      question -> {:ok, question}
    end
  end

  defp ensure_active(game), do: ensure_status(game, "active")

  defp ensure_status(%__MODULE__{status: status}, expected) when status == expected, do: :ok
  defp ensure_status(_, _), do: {:error, :invalid_state}

  defp ensure_host(%__MODULE__{host_token: host_token}, host_token), do: :ok
  defp ensure_host(_, _), do: {:error, :not_host}

  defp public_question(question, status) do
    %{
      "id" => question["id"],
      "text" => question["text"],
      "image_url" => Map.get(question, "image_url"),
      "video_url" => Map.get(question, "video_url"),
      "question_type" => question["question_type"],
      "time_limit" => question["time_limit"],
      "points" => question["points"],
      "order_index" => question["order_index"],
      "answers" =>
        Enum.map(question["answers"], fn answer ->
          public_answer(answer, status)
        end)
    }
  end

  defp public_answer(answer, status) do
    base = %{
      "id" => answer["id"],
      "text" => answer["text"],
      "image_url" => Map.get(answer, "image_url")
    }

    if status in ["reveal", "finished"] do
      Map.put(base, "is_correct", Map.get(answer, "is_correct", false))
    else
      base
    end
  end

  defp ensure_player_exists(%__MODULE__{players: players}, player_id) do
    if Map.has_key?(players, player_id), do: :ok, else: {:error, :unknown_player}
  end

  defp ensure_not_eliminated(%__MODULE__{game_mode: "survival", eliminated: eliminated}, player_id) do
    if MapSet.member?(eliminated, player_id), do: {:error, :eliminated}, else: :ok
  end

  defp ensure_not_eliminated(%__MODULE__{}, _player_id), do: :ok

  defp ensure_player_token(%__MODULE__{} = game, player_id, player_token) do
    with :ok <- ensure_player_exists(game, player_id),
         %{player_token: ^player_token} <- Map.get(game.players, player_id) do
      :ok
    else
      nil -> {:error, :unknown_player}
      _ -> {:error, :invalid_player_token}
    end
  end

  defp ensure_answer_belongs_to_question(question, answer_id) do
    if Enum.any?(question["answers"], &(&1["id"] == answer_id)),
      do: :ok,
      else: {:error, :bad_answer}
  end

  defp ensure_not_answered(game, question_id, player_id) do
    if get_in(game.answers, [question_id, player_id]), do: {:error, :already_answered}, else: :ok
  end

  defp ensure_answer_window_open(%__MODULE__{question_started_at: nil}, _question),
    do: {:error, :answer_window_closed}

  defp ensure_answer_window_open(%__MODULE__{question_started_at: started_at}, question) do
    deadline =
      DateTime.add(started_at, max(Map.get(question, "time_limit", 20), 1), :second)

    if DateTime.compare(DateTime.utc_now(), deadline) == :gt do
      {:error, :answer_window_closed}
    else
      :ok
    end
  end

  defp normalize_questions(questions) do
    questions
    |> Enum.map(fn question ->
      question_type = normalize_question_type(Map.get(question, "question_type"))

      answers =
        if question_type == "true_false" do
          [
            %{
              "id" => fetch_string(question, "true_answer_id") || "true",
              "text" => "True",
              "is_correct" =>
                Map.get(question, "correct_answer") == "true" or
                  Map.get(question, "correct_answer") == true
            },
            %{
              "id" => fetch_string(question, "false_answer_id") || "false",
              "text" => "False",
              "is_correct" =>
                Map.get(question, "correct_answer") == "false" or
                  Map.get(question, "correct_answer") == false
            }
          ]
        else
          question
          |> Map.get("answers", [])
          |> Enum.map(fn answer ->
            %{
              "id" => fetch_string(answer, "id"),
              "text" => fetch_string(answer, "text"),
              "image_url" => Map.get(answer, "image_url"),
              "is_correct" => Map.get(answer, "is_correct", false)
            }
          end)
        end

      %{
        "id" => fetch_string(question, "id"),
        "text" => fetch_string(question, "text"),
        "image_url" => Map.get(question, "image_url"),
        "video_url" => Map.get(question, "video_url"),
        "question_type" => question_type,
        "time_limit" => Map.get(question, "time_limit", 20),
        "points" => Map.get(question, "points", 1000),
        "order_index" => Map.get(question, "order_index") || Map.get(question, "order") || 0,
        "answers" => answers
      }
    end)
    |> Enum.sort_by(& &1["order_index"])
  end

  defp normalize_question_type("multiple_choice"), do: "multiple_choice"
  defp normalize_question_type("true_false"), do: "true_false"
  defp normalize_question_type(nil), do: "multiple_choice"
  defp normalize_question_type(_), do: "multiple_choice"

  defp fetch_string(map, key) do
    map
    |> Map.get(key)
    |> to_string()
  end

  defp blank_to_nil(nil), do: nil

  defp blank_to_nil(value) do
    trimmed = String.trim(to_string(value))
    if trimmed == "", do: nil, else: trimmed
  end

  defp player_id do
    "player_" <> Base.url_encode64(:crypto.strong_rand_bytes(9), padding: false)
  end

  defp normalize_nickname(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.slice(0, 20)
  end

  defp nickname_taken?(%__MODULE__{players: players}, nickname) do
    normalized = String.downcase(nickname)

    Enum.any?(players, fn {_id, player} ->
      player.nickname
      |> to_string()
      |> String.downcase() == normalized
    end)
  end

  defp normalize_game_mode("classic"), do: "classic"
  defp normalize_game_mode("survival"), do: "survival"
  defp normalize_game_mode("team"), do: "team"
  defp normalize_game_mode(_), do: "classic"

  defp normalize_category(nil), do: nil

  defp normalize_category(value) do
    trimmed = value |> to_string() |> String.trim()
    if trimmed == "", do: nil, else: trimmed
  end

  defp touch(%__MODULE__{} = game) do
    %{game | updated_at: DateTime.utc_now()}
  end

  defp token do
    :crypto.strong_rand_bytes(24)
    |> Base.url_encode64(padding: false)
  end
end
