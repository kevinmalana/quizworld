defmodule QuizworldRealtime.Game do
  @enforce_keys [:pin, :host_id, :host_token, :quiz_id, :questions, :created_at, :updated_at]
  defstruct [
    :pin,
    :host_id,
    :host_token,
    :quiz_id,
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
    answers: %{}
  ]

  @max_players 200

  def new(attrs) do
    now = DateTime.utc_now()

    %__MODULE__{
      pin: fetch_string(attrs, "pin"),
      host_id: fetch_string(attrs, "host_id"),
      host_token: token(),
      quiz_id: fetch_string(attrs, "quiz_id"),
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

    %{
      pin: game.pin,
      quiz_id: game.quiz_id,
      game_mode: game.game_mode || "classic",
      quiz: %{
        id: game.quiz_id,
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
        |> Enum.map(&Map.take(&1, [:player_id, :answer_id, :response_time_ms, :is_correct, :points_awarded]))
    }
  end

  def host_token(%__MODULE__{} = game), do: game.host_token

  def join_player(%__MODULE__{status: status} = game, _attrs) when status != "waiting" do
    {:error, :session_closed}
  end

  def join_player(%__MODULE__{players: players} = game, _attrs)
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

        {:ok,
         touch(%{game | players: Map.put(game.players, new_player_id, player)}),
         player_token,
         new_player_id}
    end
  end

  def start(%__MODULE__{} = game, host_token) do
    cond do
      host_token != game.host_token -> {:error, :not_host}
      game.status != "waiting" -> {:ok, game}
      game.questions == [] -> {:error, :no_questions}
      map_size(game.players) == 0 -> {:error, :no_players}
      true ->
        {:ok,
         touch(%{game | status: "active", current_question_index: 0, question_started_at: DateTime.utc_now()})}
    end
  end

  def submit_answer(%__MODULE__{} = game, player_id, player_token, answer_id, response_time_ms) do
    with :ok <- ensure_active(game),
         :ok <- ensure_player_token(game, player_id, player_token),
         {:ok, question} <- fetch_current_question(game),
         :ok <- ensure_answer_window_open(game, question),
         :ok <- ensure_answer_belongs_to_question(question, answer_id),
         :ok <- ensure_not_answered(game, question["id"], player_id) do
      answer_row = %{
        player_id: player_id,
        answer_id: answer_id,
        response_time_ms: max(response_time_ms || 0, 0),
        submitted_at: DateTime.utc_now(),
        is_correct: false,
        points_awarded: 0
      }

      next_answers =
        Map.update(game.answers, question["id"], %{player_id => answer_row}, fn question_answers ->
          Map.put(question_answers, player_id, answer_row)
        end)

      {:ok, touch(%{game | answers: next_answers})}
    end
  end

  def reveal_current_question(%__MODULE__{} = game, host_token) do
    with :ok <- ensure_host(game, host_token),
         :ok <- ensure_status(game, "active"),
         {:ok, question} <- fetch_current_question(game) do
      total_time_ms = max(Map.get(question, "time_limit", 20), 1) * 1000
      correct_answer_id =
        question["answers"]
        |> Enum.find(fn answer -> Map.get(answer, "is_correct", false) end)
        |> Map.fetch!("id")

      scored_rows =
        game.answers
        |> Map.get(question["id"], %{})
        |> Enum.into(%{}, fn {pid, row} ->
          is_correct = row.answer_id == correct_answer_id

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

      next_players =
        Enum.reduce(game.players, %{}, fn {pid, player}, acc ->
          scored_points =
            scored_rows
            |> Map.get(pid, %{points_awarded: 0})
            |> Map.get(:points_awarded, 0)

          Map.put(acc, pid, %{player | score: player.score + scored_points})
        end)

      {:ok,
       touch(%{
         game
         | status: "reveal",
           players: next_players,
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

      if game.current_question_index >= last_question_index do
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
      "text" => answer["text"]
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
    if Enum.any?(question["answers"], &(&1["id"] == answer_id)), do: :ok, else: {:error, :bad_answer}
  end

  defp ensure_not_answered(game, question_id, player_id) do
    if get_in(game.answers, [question_id, player_id]), do: {:error, :already_answered}, else: :ok
  end

  defp ensure_answer_window_open(%__MODULE__{question_started_at: nil}, _question), do: {:error, :answer_window_closed}

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
      %{
        "id" => fetch_string(question, "id"),
        "text" => fetch_string(question, "text"),
        "time_limit" => Map.get(question, "time_limit", 20),
        "points" => Map.get(question, "points", 1000),
        "order_index" => Map.get(question, "order_index", 0),
        "answers" =>
          question
          |> Map.get("answers", [])
          |> Enum.map(fn answer ->
            %{
              "id" => fetch_string(answer, "id"),
              "text" => fetch_string(answer, "text"),
              "is_correct" => Map.get(answer, "is_correct", false)
            }
          end)
      }
    end)
    |> Enum.sort_by(& &1["order_index"])
  end

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
  defp normalize_game_mode(_), do: "classic"

  defp touch(%__MODULE__{} = game) do
    %{game | updated_at: DateTime.utc_now()}
  end

  defp token do
    :crypto.strong_rand_bytes(24)
    |> Base.url_encode64(padding: false)
  end
end
