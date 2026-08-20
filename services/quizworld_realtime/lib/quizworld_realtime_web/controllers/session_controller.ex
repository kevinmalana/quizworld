defmodule QuizworldRealtimeWeb.SessionController do
  use QuizworldRealtimeWeb, :controller

  alias QuizworldRealtime.Auth
  alias QuizworldRealtime.Games

  def create(conn, params) do
    if blank?(params["quiz_id"]) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: "quiz_id is required"})
    else
      case Auth.authenticate_bearer(conn) do
        {:ok, user_id} ->
          attrs = %{
            "host_id" => user_id,
            "quiz_id" => params["quiz_id"],
            "category" => params["category"],
            "game_mode" => params["game_mode"],
            "questions" => params["questions"] || []
          }

          case Games.create_session(attrs) do
            {:ok, snapshot, host_token} ->
              conn
              |> put_status(:created)
              |> json(%{session: snapshot, host_token: host_token})

            {:error, reason} ->
              conn
              |> put_status(:unprocessable_entity)
              |> json(%{error: format_error(reason)})
          end

        {:error, :missing_bearer_token} ->
          conn
          |> put_status(:unauthorized)
          |> json(%{error: "Authorization bearer token is required"})

        {:error, :invalid_bearer_token} ->
          conn
          |> put_status(:unauthorized)
          |> json(%{error: "Authorization token is invalid"})

        {:error, :missing_config} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{error: "Supabase auth verification is not configured"})

        {:error, _reason} ->
          conn
          |> put_status(:unauthorized)
          |> json(%{error: "Authorization token could not be verified"})
      end
    end
  end

  def show(conn, %{"pin" => pin}) do
    case Games.snapshot(pin) do
      {:ok, snapshot} ->
        json(conn, %{session: snapshot})

      {:error, _reason} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Session not found"})
    end
  end

  def join(conn, %{"pin" => pin} = params) do
    player = %{
      "nickname" => params["nickname"],
      "avatar" => params["avatar"]
    }

    case Games.join_player(pin, player) do
      {:ok, snapshot, player_token, player_id} ->
        json(conn, %{session: snapshot, player_token: player_token, player_id: player_id})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: format_error(reason)})
    end
  end

  def reconnect(conn, %{"pin" => pin} = params) do
    player_id = params["player_id"]
    player_token = params["player_token"]

    if blank?(player_id) or blank?(player_token) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: "player_id and player_token are required"})
    else
      case Games.reconnect_player(pin, player_id, player_token) do
        {:ok, snapshot} ->
          json(conn, %{session: snapshot, player_id: player_id})

        {:error, reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: format_error(reason)})
      end
    end
  end

  def start(conn, %{"pin" => pin, "host_token" => host_token}) do
    transition(conn, Games.start_game(pin, host_token))
  end

  def start(conn, _params) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "host_token is required"})
  end

  def reveal(conn, %{"pin" => pin, "host_token" => host_token}) do
    transition(conn, Games.reveal_current_question(pin, host_token))
  end

  def reveal(conn, _params) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "host_token is required"})
  end

  def advance(conn, %{"pin" => pin, "host_token" => host_token}) do
    transition(conn, Games.advance(pin, host_token))
  end

  def advance(conn, _params) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "host_token is required"})
  end

  def answer(conn, %{"pin" => pin} = params) do
    player_id = params["player_id"]
    player_token = params["player_token"]
    answer_id = params["answer_id"]

    if blank?(player_id) or blank?(player_token) or blank?(answer_id) do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{error: "player_id, player_token, and answer_id are required"})
    else
      response_time_ms =
        case params["response_time_ms"] do
          nil ->
            0

          value when is_integer(value) ->
            value

          value ->
            case Integer.parse(to_string(value)) do
              {parsed, _rest} -> parsed
              :error -> 0
            end
        end

      transition(
        conn,
        Games.submit_answer(pin, player_id, player_token, answer_id, response_time_ms)
      )
    end
  end

  defp format_error(:not_found), do: "Session not found."
  defp format_error(:session_closed), do: "Game is not accepting new players."
  defp format_error(:game_full), do: "This game is full."
  defp format_error(:invalid_player), do: "Nickname is required."
  defp format_error(:unknown_player), do: "Player session was not found."
  defp format_error(:invalid_player_token), do: "Player session is invalid."
  defp format_error(:nickname_taken), do: "That nickname is already taken in this game."
  defp format_error(:not_host), do: "Only the host can perform this action."
  defp format_error(:session_exists), do: "A live session with this PIN already exists."
  defp format_error(:invalid_state), do: "This action is not allowed right now."
  defp format_error(:no_questions), do: "This quiz has no questions."
  defp format_error(:no_players), do: "At least one player must join before starting."
  defp format_error(:bad_answer), do: "Answer does not belong to the current question."
  defp format_error(:answer_window_closed), do: "Answer window has closed."
  defp format_error(:already_answered), do: "Your answer is already locked in."
  defp format_error(:eliminated), do: "You have been eliminated from this game."
  defp format_error(reason), do: to_string(reason)

  defp blank?(value), do: value |> to_string() |> String.trim() == ""

  defp transition(conn, {:ok, snapshot}) do
    json(conn, %{session: snapshot})
  end

  defp transition(conn, {:error, reason}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: format_error(reason)})
  end
end
