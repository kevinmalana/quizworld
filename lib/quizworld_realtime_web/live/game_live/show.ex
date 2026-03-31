defmodule QuizworldRealtimeWeb.GameLive.Show do
  use QuizworldRealtimeWeb, :live_view

  alias QuizworldRealtime.Games

  @impl true
  def mount(%{"pin" => pin} = params, _session, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(QuizworldRealtime.PubSub, Games.topic(pin))
      :timer.send_interval(1_000, self(), :tick)
    end

    with {:ok, snapshot} <- Games.snapshot(pin) do
      {:ok,
       socket
       |> assign(:pin, pin)
       |> assign(:host_token, Map.get(params, "host_token", ""))
       |> assign(:player_id, Map.get(params, "player_id", ""))
       |> assign(:player_token, Map.get(params, "player_token", ""))
       |> assign(:nickname, "")
       |> assign(:avatar, "🎮")
       |> assign(:clock_tick, System.system_time(:second))
       |> assign(:error, nil)
       |> assign_snapshot(snapshot)}
    else
      {:error, _reason} ->
        {:ok,
         socket
         |> assign(:pin, pin)
         |> assign(:host_token, Map.get(params, "host_token", ""))
         |> assign(:player_id, Map.get(params, "player_id", ""))
         |> assign(:player_token, Map.get(params, "player_token", ""))
         |> assign(:nickname, "")
         |> assign(:avatar, "🎮")
         |> assign(:clock_tick, System.system_time(:second))
         |> assign(:error, "Game not found.")
         |> assign(:snapshot, nil)}
    end
  end

  @impl true
  def handle_event("join", %{"nickname" => nickname, "avatar" => avatar}, socket) do
    case Games.join_player(socket.assigns.pin, %{
           "nickname" => nickname,
           "avatar" => avatar
         }) do
      {:ok, snapshot, player_token, player_id} ->
        {:noreply,
         socket
         |> assign(:player_id, player_id)
         |> assign(:player_token, player_token)
         |> assign(:nickname, nickname)
         |> assign(:avatar, avatar)
         |> assign(:error, nil)
         |> assign_snapshot(snapshot)}

      {:error, reason} ->
        {:noreply, assign(socket, :error, format_reason(reason))}
    end
  end

  def handle_event("host_start", _params, socket) do
    transition(socket, fn -> Games.start_game(socket.assigns.pin, socket.assigns.host_token) end)
  end

  def handle_event("host_reveal", _params, socket) do
    transition(socket, fn -> Games.reveal_current_question(socket.assigns.pin, socket.assigns.host_token) end)
  end

  def handle_event("host_advance", _params, socket) do
    transition(socket, fn -> Games.advance(socket.assigns.pin, socket.assigns.host_token) end)
  end

  def handle_event("answer", %{"answer_id" => answer_id}, socket) do
    transition(socket, fn ->
      Games.submit_answer(
        socket.assigns.pin,
        socket.assigns.player_id,
        socket.assigns.player_token,
        answer_id,
        response_time_ms(socket.assigns.snapshot)
      )
    end)
  end

  @impl true
  def handle_info({:session_updated, snapshot}, socket) do
    {:noreply, assign_snapshot(socket, snapshot)}
  end

  @impl true
  def handle_info(:tick, socket) do
    {:noreply, assign(socket, :clock_tick, System.system_time(:second))}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="game-shell" data-clock={@clock_tick} style={shell_style(@snapshot)}>
      <style>
        .game-shell .hero-glow::after {
          content: "";
          position: absolute;
          inset: auto -12% -42% auto;
          width: 280px;
          height: 280px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.34), transparent 68%);
          pointer-events: none;
        }

        .game-shell .card-rise {
          animation: card-rise 420ms ease-out both;
        }

        .game-shell .lobby-pulse {
          animation: lobby-pulse 2.8s ease-in-out infinite;
        }

        .game-shell .answer-choice:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 34px rgba(15, 23, 42, 0.1);
        }

        .game-shell .leaderboard-card {
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .game-shell .leaderboard-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.08);
        }

        .game-shell .game-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.9fr) minmax(280px, 0.95fr);
          gap: 1.25rem;
          align-items: start;
        }

        .game-shell .game-sidebar {
          display: grid;
          gap: 1rem;
          align-content: start;
        }

        @keyframes card-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes lobby-pulse {
          0%,
          100% {
            box-shadow: 0 22px 54px rgba(15, 23, 42, 0.12);
          }

          50% {
            box-shadow: 0 26px 70px rgba(37, 99, 235, 0.14);
          }
        }

        @media (max-width: 980px) {
          .game-shell .game-grid {
            grid-template-columns: 1fr;
          }

          .game-shell .game-sidebar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .game-shell .game-sidebar {
            grid-template-columns: 1fr;
          }

          .game-shell .hero-stats {
            width: 100%;
            min-width: 0;
          }

          .game-shell .timer-orb {
            width: 80px;
            height: 80px;
            font-size: 1.7rem;
          }
        }
      </style>
      <div style="max-width:1180px;margin:0 auto;position:relative;z-index:1;">
        <div style="display:grid;gap:1.5rem;">
          <div class="hero-glow card-rise" style={hero_style()}>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
              <div style="max-width:720px;">
                <div style={eyebrow_style()}>
                  QUIZWORLD LIVE STAGE
                </div>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">
                  <h1 style="margin:0;font-size:clamp(2.2rem,4vw,3.8rem);line-height:0.95;font-weight:950;letter-spacing:-0.04em;color:white;">
                    PIN <%= @pin %>
                  </h1>
                  <div style={status_pill_style(@snapshot)}>
                    <%= status_label(@snapshot) %>
                  </div>
                </div>
                <div style="font-size:1.15rem;line-height:1.6;color:rgba(255,255,255,0.78);max-width:680px;">
                  <%= stage_copy(@snapshot, @host_token, @player_token) %>
                </div>
              </div>

              <%= if @snapshot do %>
                <div class="hero-stats" style={hero_stat_card_style()}>
                  <div style="font-size:0.78rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;">Live Room</div>
                  <div style="display:grid;gap:0.85rem;margin-top:0.85rem;">
                    <div style="display:flex;justify-content:space-between;gap:1rem;">
                      <span style="color:#cbd5e1;">Players</span>
                      <strong style="color:white;font-size:1.1rem;"><%= length(@snapshot.players || []) %></strong>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:1rem;">
                      <span style="color:#cbd5e1;">Question</span>
                      <strong style="color:white;font-size:1.1rem;"><%= question_progress(@snapshot) %></strong>
                    </div>
                    <div :if={active?(@snapshot)} style="display:flex;justify-content:space-between;gap:1rem;">
                      <span style="color:#cbd5e1;">Timer</span>
                      <strong style="color:#fef08a;font-size:1.35rem;"><%= time_left(@snapshot.current_question, @snapshot.question_started_at) %>s</strong>
                    </div>
                  </div>
                </div>
              <% end %>
            </div>
          </div>

          <%= if @error do %>
            <div style={error_banner_style()}>
              <%= @error %>
            </div>
          <% end %>

          <%= if @snapshot do %>
            <div class="game-grid">
              <div class={"card-rise #{if waiting?(@snapshot), do: "lobby-pulse", else: ""}"} style={main_stage_style()}>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem;">
                  <div>
                    <div style={eyebrow_dark_style()}><%= stage_eyebrow(@snapshot) %></div>
                    <div style="font-size:clamp(1.5rem,3vw,2.25rem);font-weight:900;letter-spacing:-0.03em;color:#0f172a;">
                      <%= stage_title(@snapshot) %>
                    </div>
                  </div>
                  <%= if active?(@snapshot) do %>
                    <div class="timer-orb" style={timer_badge_style(time_left(@snapshot.current_question, @snapshot.question_started_at))}>
                      <%= time_left(@snapshot.current_question, @snapshot.question_started_at) %>
                    </div>
                  <% end %>
                </div>

                <%= if waiting?(@snapshot) do %>
                  <div style={feature_panel_style("#0f172a", "rgba(255,255,255,0.72)")}>
                    <div style="font-size:1.55rem;font-weight:900;color:white;margin-bottom:0.75rem;">The stage is live. Build the crowd.</div>
                    <div style="font-size:1rem;line-height:1.7;">
                      Share the PIN, let the room fill up, and start when the energy is right. The host controls the opening moment.
                    </div>
                  </div>
                <% end %>

                <%= if active?(@snapshot) do %>
                  <div style="margin-bottom:1.2rem;padding:1.5rem 1.4rem;border-radius:28px;background:linear-gradient(145deg,#0f172a,#1e293b);box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);">
                    <div style="font-size:0.82rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#93c5fd;margin-bottom:0.85rem;">
                      Question on deck
                    </div>
                    <div style="font-size:clamp(1.35rem,2.4vw,2.25rem);line-height:1.18;font-weight:950;letter-spacing:-0.03em;color:white;">
                      <%= @snapshot.current_question["text"] %>
                    </div>
                  </div>

                  <div style="display:grid;gap:0.85rem;">
                    <%= for {answer, index} <- Enum.with_index(@snapshot.current_question["answers"], 1) do %>
                      <button
                        class={if can_answer?(@snapshot, @player_id), do: "answer-choice", else: nil}
                        phx-click="answer"
                        phx-value-answer_id={answer["id"]}
                        disabled={!can_answer?(@snapshot, @player_id)}
                        style={answer_button_style(index, can_answer?(@snapshot, @player_id), selected_answer?(@snapshot, @player_id, answer["id"]))}
                      >
                        <span style={answer_index_style(selected_answer?(@snapshot, @player_id, answer["id"]))}>
                          <%= answer_label(index) %>
                        </span>
                        <span style="flex:1;"><%= answer["text"] %></span>
                        <span :if={selected_answer?(@snapshot, @player_id, answer["id"])} style="font-size:0.82rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;">
                          Locked
                        </span>
                      </button>
                    <% end %>
                  </div>
                <% end %>

                <%= if reveal?(@snapshot) do %>
                  <div style="margin-bottom:1rem;padding:1.5rem 1.4rem;border-radius:28px;background:linear-gradient(145deg,#fff7ed,#ffffff);border:1px solid #fdba74;">
                    <div style="font-size:0.82rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;margin-bottom:0.85rem;">
                      Reveal
                    </div>
                    <div style="font-size:clamp(1.35rem,2.4vw,2.1rem);line-height:1.18;font-weight:950;letter-spacing:-0.03em;color:#7c2d12;">
                      <%= @snapshot.current_question["text"] %>
                    </div>
                  </div>

                  <%= if own_answer = own_answer(@snapshot, @player_id) do %>
                    <div style={personal_result_style(own_answer)}>
                      <strong><%= if own_answer[:is_correct], do: "Correct.", else: "Not this round." %></strong>
                      You earned <%= own_answer[:points_awarded] || 0 %> points.
                    </div>
                  <% end %>

                  <div style="display:grid;gap:0.85rem;">
                    <%= for answer <- @snapshot.current_question["answers"] do %>
                      <div style={reveal_answer_style(answer)}>
                        <div>
                          <div style="font-size:1rem;font-weight:850;color:#0f172a;"><%= answer["text"] %></div>
                          <div style="font-size:0.84rem;color:#64748b;font-weight:700;margin-top:0.25rem;">
                            <%= answer["count"] || 0 %> players locked this in
                          </div>
                        </div>
                        <div style={reveal_badge_style(answer)}>
                          <%= if answer["is_correct"], do: "Correct", else: "Miss" %>
                        </div>
                      </div>
                    <% end %>
                  </div>
                <% end %>

                <%= if finished?(@snapshot) do %>
                  <div style="padding:1.8rem 1.5rem;border-radius:28px;background:linear-gradient(145deg,#111827,#1f2937);margin-bottom:1rem;">
                    <div style="font-size:0.82rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#fde68a;margin-bottom:0.75rem;">
                      Final Result
                    </div>
                    <div style="font-size:clamp(1.6rem,2.8vw,2.5rem);line-height:1.05;font-weight:950;letter-spacing:-0.04em;color:white;">
                      Game finished. The leaderboard is locked.
                    </div>
                  </div>
                <% end %>
              </div>

              <div class="game-sidebar">
                <div class="card-rise" style={side_panel_style()}>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:0.85rem;">
                    <div>
                      <div style={eyebrow_dark_style()}>Live Leaderboard</div>
                      <div style="font-size:1.2rem;font-weight:900;color:#0f172a;">Players</div>
                    </div>
                    <div style="font-size:0.88rem;font-weight:800;color:#64748b;"><%= length(@snapshot.players || []) %> joined</div>
                  </div>
                  <div style="display:grid;gap:0.75rem;">
                    <%= for {player, index} <- Enum.with_index(sorted_players(@snapshot), 1) do %>
                      <div class="leaderboard-card" style={leaderboard_row_style(index, @player_id, player)}>
                        <div style="display:flex;align-items:center;gap:0.8rem;min-width:0;">
                          <div style={rank_style(index)}><%= index %></div>
                          <div style="min-width:0;">
                            <div style="font-weight:850;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                              <%= player[:avatar] || "🎮" %> <%= player[:nickname] %>
                            </div>
                            <div style="font-size:0.78rem;color:#64748b;font-weight:800;">
                              <%= if player[:id] == @player_id, do: "You", else: "Player" %>
                            </div>
                          </div>
                        </div>
                        <div style="font-weight:900;color:#0f172a;"><%= player[:score] || 0 %></div>
                      </div>
                    <% end %>
                  </div>
                </div>

                <%= if host_controls?(@snapshot, @host_token) do %>
                  <div class="card-rise" style={side_panel_style()}>
                    <div style={eyebrow_dark_style()}>Host Deck</div>
                    <div style="font-size:1.2rem;font-weight:900;color:#0f172a;margin-bottom:0.85rem;">Run the show</div>
                    <div style="display:grid;gap:0.75rem;">
                      <button :if={waiting?(@snapshot)} phx-click="host_start" style={button_style("#1d4ed8")}>Open Round One</button>
                      <button :if={active?(@snapshot)} phx-click="host_reveal" style={button_style("#7c3aed")}>Reveal Answers</button>
                      <button :if={reveal?(@snapshot)} phx-click="host_advance" style={button_style("#059669")}>
                        <%= if last_question?(@snapshot), do: "Finish Show", else: "Next Question" %>
                      </button>
                    </div>
                  </div>
                <% else %>
                  <div class="card-rise" style={side_panel_style()}>
                    <div style={eyebrow_dark_style()}>Player Access</div>
                    <div style="font-size:1.2rem;font-weight:900;color:#0f172a;margin-bottom:0.85rem;">Get on stage</div>
                    <%= if @player_token == "" and waiting?(@snapshot) do %>
                      <form phx-submit="join" style="display:grid;gap:0.75rem;">
                        <input type="text" name="nickname" value={@nickname} placeholder="Nickname" style={input_style()} />
                        <input type="text" name="avatar" value={@avatar} placeholder="Avatar" style={input_style()} />
                        <button type="submit" style={button_style("#1d4ed8")}>Join Lobby</button>
                      </form>
                    <% else %>
                      <div style="padding:1rem;border-radius:18px;background:#eff6ff;color:#1d4ed8;font-weight:800;line-height:1.6;">
                        <%= spectator_copy(@snapshot, @player_token) %>
                      </div>
                    <% end %>
                  </div>
                <% end %>
              </div>
            </div>
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  defp transition(socket, callback) do
    case callback.() do
      {:ok, snapshot} ->
        {:noreply, socket |> assign(:error, nil) |> assign_snapshot(snapshot)}

      {:error, reason} ->
        {:noreply, assign(socket, :error, format_reason(reason))}
    end
  end

  defp assign_snapshot(socket, snapshot) do
    assign(socket, :snapshot, snapshot)
  end

  defp sorted_players(nil), do: []

  defp sorted_players(snapshot) do
    (snapshot.players || [])
    |> Enum.sort_by(&(-(&1[:score] || 0)))
  end

  defp own_answer(nil, _player_id), do: nil

  defp own_answer(snapshot, player_id) do
    Enum.find(snapshot.current_answers || [], &(&1[:player_id] == player_id))
  end

  defp selected_answer?(nil, _player_id, _answer_id), do: false

  defp selected_answer?(snapshot, player_id, answer_id) do
    case own_answer(snapshot, player_id) do
      nil -> false
      answer -> answer[:answer_id] == answer_id
    end
  end

  defp waiting?(nil), do: false
  defp waiting?(snapshot), do: snapshot.status == "waiting"
  defp active?(nil), do: false
  defp active?(snapshot), do: snapshot.status == "active"
  defp reveal?(nil), do: false
  defp reveal?(snapshot), do: snapshot.status == "reveal"
  defp finished?(nil), do: false
  defp finished?(snapshot), do: snapshot.status == "finished"

  defp last_question?(nil), do: false

  defp last_question?(snapshot) do
    (snapshot.current_question_index || 0) >= max(length(get_in(snapshot, [:quiz, :questions]) || []) - 1, 0)
  end

  defp host_controls?(nil, _host_token), do: false
  defp host_controls?(_snapshot, host_token), do: host_token != ""

  defp can_answer?(nil, _player_id), do: false

  defp can_answer?(snapshot, player_id) do
    snapshot.status == "active" and player_id != "" and time_left(snapshot.current_question, snapshot.question_started_at) > 0 and
      not already_answered?(snapshot, player_id)
  end

  defp already_answered?(nil, _player_id), do: false

  defp already_answered?(snapshot, player_id) do
    Enum.any?(snapshot.current_answers || [], &(&1[:player_id] == player_id))
  end

  defp time_left(nil, _started_at), do: 0

  defp time_left(question, started_at) do
    total = question["time_limit"] || 20

    if started_at do
      elapsed = div(DateTime.diff(DateTime.utc_now(), parse_datetime(started_at), :millisecond), 1000)
      max(total - elapsed, 0)
    else
      total
    end
  end

  defp parse_datetime(%DateTime{} = value), do: value

  defp parse_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> datetime
      _ -> DateTime.utc_now()
    end
  end

  defp status_label(nil), do: "Loading"
  defp status_label(snapshot), do: String.upcase(snapshot.status)

  defp stage_title(snapshot) when snapshot.status == "waiting", do: "The lobby is warming up"
  defp stage_title(snapshot) when snapshot.status == "active", do: "Question in play"
  defp stage_title(snapshot) when snapshot.status == "reveal", do: "Answers on the board"
  defp stage_title(snapshot) when snapshot.status == "finished", do: "Final standings"
  defp stage_title(_snapshot), do: "Live game"

  defp stage_eyebrow(snapshot) when snapshot.status == "waiting", do: "Lobby"
  defp stage_eyebrow(snapshot) when snapshot.status == "active", do: "Question"
  defp stage_eyebrow(snapshot) when snapshot.status == "reveal", do: "Reveal"
  defp stage_eyebrow(snapshot) when snapshot.status == "finished", do: "Results"
  defp stage_eyebrow(_snapshot), do: "Live"

  defp stage_copy(nil, _host_token, _player_token), do: "Connecting to the live room."

  defp stage_copy(snapshot, host_token, player_token) do
    cond do
      host_controls?(snapshot, host_token) and waiting?(snapshot) ->
        "You are in control. Build the room, then open the first round when the lobby feels full."

      host_controls?(snapshot, host_token) and active?(snapshot) ->
        "You are running the show. Watch answer volume climb and trigger the reveal when the round peaks."

      host_controls?(snapshot, host_token) and reveal?(snapshot) ->
        "The crowd has answered. Let the leaderboard breathe, then send them into the next round."

      waiting?(snapshot) and player_token == "" ->
        "Join the lobby, claim a nickname, and wait for the host to kick off the first question."

      waiting?(snapshot) ->
        "You are in the room. Stay sharp for the opening countdown."

      active?(snapshot) ->
        "Fast answers win bigger points. Lock in your choice before the timer burns out."

      reveal?(snapshot) ->
        "See what the room chose, find the right answer, and watch the standings shift."

      finished?(snapshot) ->
        "The game is done. Celebrate the podium, compare scores, and decide who hosts the rematch."

      true ->
        "Live game session connected."
    end
  end

  defp spectator_copy(snapshot, player_token) do
    cond do
      waiting?(snapshot) and player_token != "" -> "You are in. Stay here and the stage will update live."
      active?(snapshot) and player_token != "" -> "You are locked in as a player. Watch for the reveal."
      player_token == "" -> "This screen follows the show live. Join before the round starts to play."
      true -> "The game is moving live. Watch the board for the next shift."
    end
  end

  defp question_progress(nil), do: "0/0"

  defp question_progress(snapshot) do
    current = (snapshot.current_question_index || -1) + 1
    total = length(get_in(snapshot, [:quiz, :questions]) || [])

    if total > 0 and current > 0 do
      "#{current}/#{total}"
    else
      "0/0"
    end
  end

  defp response_time_ms(nil), do: 0

  defp response_time_ms(snapshot) do
    current_limit =
      snapshot
      |> Map.get(:current_question, %{})
      |> Map.get("time_limit", 20)

    started_at = Map.get(snapshot, :question_started_at)

    if started_at do
      elapsed =
        DateTime.diff(DateTime.utc_now(), parse_datetime(started_at), :millisecond)

      elapsed
      |> max(0)
      |> min(max(current_limit, 1) * 1000)
    else
      0
    end
  end

  defp format_reason(:session_closed), do: "Game is not accepting new players."
  defp format_reason(:invalid_player), do: "Nickname is required."
  defp format_reason(:nickname_taken), do: "That nickname is already taken in this game."
  defp format_reason(:invalid_player_token), do: "Player session is invalid."
  defp format_reason(:unknown_player), do: "Join the lobby again to keep playing."
  defp format_reason(:not_host), do: "Only the host can do that."
  defp format_reason(:invalid_state), do: "That action is not allowed right now."
  defp format_reason(:already_answered), do: "Answer already locked in."
  defp format_reason(:answer_window_closed), do: "Answer window has closed."
  defp format_reason(:no_players), do: "At least one player must join before the show can start."
  defp format_reason(:no_questions), do: "This quiz has no playable questions."
  defp format_reason(:no_current_question), do: "There is no active question right now."
  defp format_reason(:bad_answer), do: "That answer does not belong to this question."
  defp format_reason(reason), do: to_string(reason)

  defp button_style(color) do
    "padding:1rem 1.1rem;border:none;border-radius:18px;background:#{color};color:white;font-size:1rem;font-weight:900;letter-spacing:-0.01em;cursor:pointer;box-shadow:0 14px 35px rgba(15,23,42,0.18);"
  end

  defp input_style do
    "padding:0.95rem 1rem;border:1px solid #d1d5db;border-radius:16px;font-size:1rem;background:white;"
  end

  defp shell_style(snapshot) do
    background =
      cond do
        active?(snapshot) -> "radial-gradient(circle at top, rgba(37,99,235,0.30), transparent 35%), linear-gradient(180deg, #07111f 0%, #0f172a 42%, #eff4ff 42.01%, #eff4ff 100%)"
        reveal?(snapshot) -> "radial-gradient(circle at top, rgba(245,158,11,0.28), transparent 34%), linear-gradient(180deg, #211108 0%, #3f1d05 42%, #fff7ed 42.01%, #fff7ed 100%)"
        finished?(snapshot) -> "radial-gradient(circle at top, rgba(168,85,247,0.26), transparent 34%), linear-gradient(180deg, #170b2d 0%, #2e1065 42%, #f5f3ff 42.01%, #f5f3ff 100%)"
        true -> "radial-gradient(circle at top, rgba(16,185,129,0.22), transparent 34%), linear-gradient(180deg, #06131b 0%, #10253c 42%, #f5f7fb 42.01%, #f5f7fb 100%)"
      end

    "min-height:100vh;background:#{background};padding:2rem 1rem 4rem;font-family:'Plus Jakarta Sans',system-ui,sans-serif;"
  end

  defp hero_style do
    "position:relative;overflow:hidden;padding:1.85rem 1.85rem 1.65rem;border-radius:32px;background:linear-gradient(145deg,rgba(15,23,42,0.86),rgba(30,41,59,0.76));backdrop-filter:blur(18px);box-shadow:0 28px 80px rgba(15,23,42,0.26);border:1px solid rgba(255,255,255,0.1);"
  end

  defp hero_stat_card_style do
    "min-width:240px;padding:1rem 1.1rem;border-radius:24px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(10px);"
  end

  defp eyebrow_style do
    "display:inline-flex;align-items:center;gap:0.5rem;padding:0.42rem 0.7rem;border-radius:999px;background:rgba(148,163,184,0.16);font-size:0.73rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#bfdbfe;margin-bottom:0.9rem;"
  end

  defp eyebrow_dark_style do
    "font-size:0.74rem;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;margin-bottom:0.35rem;"
  end

  defp status_pill_style(snapshot) do
    colors =
      cond do
        waiting?(snapshot) -> {"rgba(16,185,129,0.16)", "#bbf7d0"}
        active?(snapshot) -> {"rgba(59,130,246,0.16)", "#bfdbfe"}
        reveal?(snapshot) -> {"rgba(245,158,11,0.16)", "#fde68a"}
        finished?(snapshot) -> {"rgba(168,85,247,0.16)", "#e9d5ff"}
        true -> {"rgba(255,255,255,0.12)", "#e2e8f0"}
      end

    {bg, fg} = colors
    "padding:0.72rem 1rem;border-radius:999px;background:#{bg};border:1px solid rgba(255,255,255,0.08);font-weight:900;letter-spacing:0.08em;font-size:0.78rem;color:#{fg};text-transform:uppercase;"
  end

  defp error_banner_style do
    "background:linear-gradient(145deg,#7f1d1d,#991b1b);color:#fee2e2;padding:1rem 1.15rem;border-radius:18px;margin-bottom:0.5rem;font-weight:800;box-shadow:0 18px 40px rgba(127,29,29,0.18);"
  end

  defp main_stage_style do
    "background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border:1px solid rgba(148,163,184,0.22);border-radius:32px;padding:1.35rem;box-shadow:0 24px 70px rgba(15,23,42,0.12);"
  end

  defp side_panel_style do
    "background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);border:1px solid rgba(148,163,184,0.22);border-radius:28px;padding:1.15rem;box-shadow:0 18px 50px rgba(15,23,42,0.10);"
  end

  defp feature_panel_style(bg, fg) do
    "padding:1.45rem 1.35rem;border-radius:26px;background:#{bg};color:#{fg};margin-bottom:0.35rem;"
  end

  defp timer_badge_style(time_left) do
    color =
      cond do
        time_left <= 5 -> "#dc2626"
        time_left <= 10 -> "#d97706"
        true -> "#2563eb"
      end

    bg =
      cond do
        time_left <= 5 -> "#fee2e2"
        time_left <= 10 -> "#ffedd5"
        true -> "#dbeafe"
      end

    "width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:#{bg};color:#{color};font-size:2.1rem;font-weight:950;box-shadow:inset 0 0 0 8px rgba(255,255,255,0.7);"
  end

  defp answer_button_style(index, enabled?, selected?) do
    palette =
      case rem(index, 4) do
        1 -> {"#eff6ff", "#bfdbfe", "#1d4ed8"}
        2 -> {"#f5f3ff", "#ddd6fe", "#6d28d9"}
        3 -> {"#ecfeff", "#a5f3fc", "#0f766e"}
        _ -> {"#fff7ed", "#fdba74", "#c2410c"}
      end

    {bg, border, ink} = palette

    cond do
      selected? ->
        "padding:1rem 1.05rem;text-align:left;border-radius:22px;border:2px solid #{ink};background:#{bg};font-size:1rem;font-weight:850;cursor:default;color:#0f172a;display:flex;align-items:center;gap:0.95rem;box-shadow:0 14px 35px rgba(37,99,235,0.12);"

      enabled? ->
        "padding:1rem 1.05rem;text-align:left;border-radius:22px;border:2px solid #{border};background:white;font-size:1rem;font-weight:850;cursor:pointer;color:#0f172a;display:flex;align-items:center;gap:0.95rem;transition:all 180ms ease;box-shadow:0 12px 26px rgba(15,23,42,0.06);"

      true ->
        "padding:1rem 1.05rem;text-align:left;border-radius:22px;border:2px solid #e2e8f0;background:#f8fafc;font-size:1rem;font-weight:850;cursor:not-allowed;color:#94a3b8;display:flex;align-items:center;gap:0.95rem;"
    end
  end

  defp answer_index_style(selected?) do
    if selected? do
      "width:2.4rem;height:2.4rem;border-radius:999px;display:grid;place-items:center;background:#1d4ed8;color:white;font-weight:950;flex-shrink:0;"
    else
      "width:2.4rem;height:2.4rem;border-radius:999px;display:grid;place-items:center;background:#e2e8f0;color:#334155;font-weight:950;flex-shrink:0;"
    end
  end

  defp answer_label(index), do: <<(?A + index - 1)>>

  defp personal_result_style(answer) do
    if answer[:is_correct] do
      "padding:1rem 1.1rem;border-radius:18px;background:#dcfce7;color:#166534;font-weight:800;margin-bottom:1rem;border:1px solid #86efac;"
    else
      "padding:1rem 1.1rem;border-radius:18px;background:#fee2e2;color:#991b1b;font-weight:800;margin-bottom:1rem;border:1px solid #fca5a5;"
    end
  end

  defp reveal_answer_style(answer) do
    if answer["is_correct"] do
      "padding:1rem 1.05rem;border-radius:20px;border:2px solid #16a34a;background:linear-gradient(145deg,#dcfce7,#f0fdf4);display:flex;justify-content:space-between;align-items:center;gap:1rem;"
    else
      "padding:1rem 1.05rem;border-radius:20px;border:1px solid #e5e7eb;background:white;display:flex;justify-content:space-between;align-items:center;gap:1rem;"
    end
  end

  defp reveal_badge_style(answer) do
    if answer["is_correct"] do
      "padding:0.5rem 0.7rem;border-radius:999px;background:#16a34a;color:white;font-size:0.72rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;"
    else
      "padding:0.5rem 0.7rem;border-radius:999px;background:#e2e8f0;color:#475569;font-size:0.72rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;"
    end
  end

  defp leaderboard_row_style(index, current_player_id, player) do
    if player[:id] == current_player_id do
      "display:flex;justify-content:space-between;gap:0.85rem;background:linear-gradient(145deg,#dbeafe,#eff6ff);padding:0.85rem;border-radius:18px;border:1px solid #93c5fd;align-items:center;"
    else
      base =
        case index do
          1 -> "background:linear-gradient(145deg,#fef3c7,#fffbeb);border:1px solid #fcd34d;"
          2 -> "background:linear-gradient(145deg,#e2e8f0,#f8fafc);border:1px solid #cbd5e1;"
          3 -> "background:linear-gradient(145deg,#fed7aa,#fff7ed);border:1px solid #fdba74;"
          _ -> "background:#f8fafc;border:1px solid #e2e8f0;"
        end

      "display:flex;justify-content:space-between;gap:0.85rem;#{base}padding:0.85rem;border-radius:18px;align-items:center;"
    end
  end

  defp rank_style(index) do
    bg =
      case index do
        1 -> "#f59e0b"
        2 -> "#94a3b8"
        3 -> "#c2410c"
        _ -> "#0f172a"
      end

    "width:2rem;height:2rem;border-radius:999px;background:#{bg};color:white;display:grid;place-items:center;font-weight:950;flex-shrink:0;"
  end
end
