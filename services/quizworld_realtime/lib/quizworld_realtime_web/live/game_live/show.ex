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
    <link rel="stylesheet" href="/game.css" />
    <div class={"game-shell game-shell--#{status_class(@snapshot)}"} data-clock={@clock_tick}>
      <div style="max-width:1180px;margin:0 auto;position:relative;z-index:1;">
        <div style="display:grid;gap:1.5rem;">
          <%# ── Hero ─────────────────────────────────────────────── %>
          <div class="game-hero card-rise">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
              <div style="max-width:720px;">
                <div class="game-eyebrow">QUIZWORLD LIVE STAGE</div>
                <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.75rem;">
                  <h1 style="margin:0;font-size:clamp(2.2rem,4vw,3.8rem);line-height:0.95;font-weight:950;letter-spacing:-0.04em;color:white;">
                    PIN <%= @pin %>
                  </h1>
                  <div class={"game-status-pill game-status-pill--#{status_class(@snapshot)}"}>
                    <%= status_label(@snapshot) %>
                  </div>
                  <%= if @snapshot && @snapshot.category do %>
                    <div style="padding:0.5rem 0.9rem;border-radius:999px;background:rgba(148,163,184,0.20);border:1px solid rgba(255,255,255,0.12);font-size:0.78rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#e2e8f0;">
                      <%= @snapshot.category %>
                    </div>
                  <% end %>
                </div>
                <div style="font-size:1.15rem;line-height:1.6;color:rgba(255,255,255,0.78);max-width:680px;">
                  <%= stage_copy(@snapshot, @host_token, @player_token) %>
                </div>
              </div>

              <%= if @snapshot do %>
                <div class="game-hero-stats">
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

          <%# ── Error ────────────────────────────────────────────── %>
          <%= if @error do %>
            <div class="game-error"><%= @error %></div>
          <% end %>

          <%= if @snapshot do %>
            <div class="game-grid">
              <%# ── Main Stage ────────────────────────────────────── %>
              <div class={"game-stage card-rise #{if waiting?(@snapshot), do: "lobby-pulse", else: ""}"}>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.2rem;">
                  <div>
                    <div class="game-eyebrow--dark">
                      <%= stage_eyebrow(@snapshot) %><%= if @snapshot && @snapshot.category, do: " · #{@snapshot.category}" %>
                    </div>
                    <div style="font-size:clamp(1.5rem,3vw,2.25rem);font-weight:900;letter-spacing:-0.03em;color:#0f172a;">
                      <%= stage_title(@snapshot) %>
                    </div>
                  </div>
                  <%= if active?(@snapshot) do %>
                    <div class={"game-timer #{timer_class(time_left(@snapshot.current_question, @snapshot.question_started_at))}"}>
                      <%= time_left(@snapshot.current_question, @snapshot.question_started_at) %>
                    </div>
                  <% end %>
                </div>

                <%# ── Waiting State ───────────────────────────────── %>
                <%= if waiting?(@snapshot) do %>
                  <div class="game-feature">
                    <div style="font-size:1.55rem;font-weight:900;color:white;margin-bottom:0.75rem;">The stage is live. Build the crowd.</div>
                    <div style="font-size:1rem;line-height:1.7;">
                      Share the PIN, let the room fill up, and start when the energy is right. The host controls the opening moment.
                    </div>
                  </div>
                <% end %>

                <%# ── Active State ────────────────────────────────── %>
                <%= if active?(@snapshot) do %>
                  <div style="margin-bottom:1.2rem;padding:1.5rem 1.4rem;border-radius:28px;background:linear-gradient(145deg,#0f172a,#1e293b);box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);">
                    <div style="font-size:0.82rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#93c5fd;margin-bottom:0.85rem;">
                      Question on deck
                    </div>
                    <%= if @snapshot.current_question["image_url"] do %>
                      <img src={@snapshot.current_question["image_url"]} alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:16px;margin-bottom:1rem;" />
                    <% end %>
                    <div style="font-size:clamp(1.35rem,2.4vw,2.25rem);line-height:1.18;font-weight:950;letter-spacing:-0.03em;color:white;">
                      <%= @snapshot.current_question["text"] %>
                    </div>
                  </div>

                  <div style="display:grid;gap:0.85rem;">
                    <%= for {answer, index} <- Enum.with_index(@snapshot.current_question["answers"], 1) do %>
                      <button
                        class={answer_class(index, can_answer?(@snapshot, @player_id), selected_answer?(@snapshot, @player_id, answer["id"]))}
                        phx-click="answer"
                        phx-value-answer_id={answer["id"]}
                        disabled={!can_answer?(@snapshot, @player_id)}
                      >
                        <span class={"game-answer-index #{if selected_answer?(@snapshot, @player_id, answer["id"]), do: "game-answer-index--selected", else: ""}"}>
                          <%= answer_label(index) %>
                        </span>
                        <div style="flex:1;display:flex;align-items:center;gap:0.75rem;">
                          <%= if answer["image_url"] do %>
                            <img src={answer["image_url"]} alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;" />
                          <% end %>
                          <span><%= answer["text"] %></span>
                        </div>
                        <span :if={selected_answer?(@snapshot, @player_id, answer["id"])} style="font-size:0.82rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#1d4ed8;">
                          Locked
                        </span>
                      </button>
                    <% end %>
                  </div>
                <% end %>

                <%# ── Reveal State ────────────────────────────────── %>
                <%= if reveal?(@snapshot) do %>
                  <div style="margin-bottom:1rem;padding:1.5rem 1.4rem;border-radius:28px;background:linear-gradient(145deg,#fff7ed,#ffffff);border:1px solid #fdba74;">
                    <div style="font-size:0.82rem;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;margin-bottom:0.85rem;">
                      Reveal
                    </div>
                    <%= if @snapshot.current_question["image_url"] do %>
                      <img src={@snapshot.current_question["image_url"]} alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:16px;margin-bottom:1rem;" />
                    <% end %>
                    <div style="font-size:clamp(1.35rem,2.4vw,2.1rem);line-height:1.18;font-weight:950;letter-spacing:-0.03em;color:#7c2d12;">
                      <%= @snapshot.current_question["text"] %>
                    </div>
                  </div>

                  <%= if own_answer = own_answer(@snapshot, @player_id) do %>
                    <div class={if own_answer[:is_correct], do: "game-result--correct", else: "game-result--wrong"}>
                      <strong><%= if own_answer[:is_correct], do: "Correct.", else: "Not this round." %></strong>
                      You earned <%= own_answer[:points_awarded] || 0 %> points.
                    </div>
                  <% end %>

                  <div style="display:grid;gap:0.85rem;">
                    <%= for answer <- @snapshot.current_question["answers"] do %>
                      <div class={if answer["is_correct"], do: "game-reveal-answer game-reveal-answer--correct", else: "game-reveal-answer"}>
                        <div style="display:flex;align-items:center;gap:0.75rem;">
                          <%= if answer["image_url"] do %>
                            <img src={answer["image_url"]} alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0;" />
                          <% end %>
                          <div>
                            <div style="font-size:1rem;font-weight:850;color:#0f172a;"><%= answer["text"] %></div>
                            <div style="font-size:0.84rem;color:#64748b;font-weight:700;margin-top:0.25rem;">
                              <%= answer["count"] || 0 %> players locked this in
                            </div>
                          </div>
                        </div>
                        <div class={if answer["is_correct"], do: "game-reveal-badge game-reveal-badge--correct", else: "game-reveal-badge"}>
                          <%= if answer["is_correct"], do: "Correct", else: "Miss" %>
                        </div>
                      </div>
                    <% end %>
                  </div>
                <% end %>

                <%# ── Finished State ──────────────────────────────── %>
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

              <%# ── Sidebar ──────────────────────────────────────── %>
              <div class="game-sidebar">
                <%# ── Leaderboard ─────────────────────────────────── %>
                <div class="game-panel card-rise">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:0.85rem;">
                    <div>
                      <div class="game-eyebrow--dark">Live Leaderboard</div>
                      <div style="font-size:1.2rem;font-weight:900;color:#0f172a;">Players</div>
                    </div>
                    <div style="font-size:0.88rem;font-weight:800;color:#64748b;"><%= length(@snapshot.players || []) %> joined</div>
                  </div>
                  <div style="display:grid;gap:0.75rem;">
                    <%= for {player, index} <- Enum.with_index(sorted_players(@snapshot), 1) do %>
                      <div class={leaderboard_class(index, @player_id, player)}>
                        <div style="display:flex;align-items:center;gap:0.8rem;min-width:0;">
                          <div class={rank_class(index)}><%= index %></div>
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

                <%# ── Host Controls ──────────────────────────────── %>
                <%= if host_controls?(@snapshot, @host_token) do %>
                  <div class="game-panel card-rise">
                    <div class="game-eyebrow--dark">Host Deck</div>
                    <div style="font-size:1.2rem;font-weight:900;color:#0f172a;margin-bottom:0.85rem;">Run the show</div>
                    <div style="display:grid;gap:0.75rem;">
                      <button :if={waiting?(@snapshot)} phx-click="host_start" class="game-btn game-btn--blue">Open Round One</button>
                      <button :if={active?(@snapshot)} phx-click="host_reveal" class="game-btn game-btn--purple">Reveal Answers</button>
                      <button :if={reveal?(@snapshot)} phx-click="host_advance" class="game-btn game-btn--green">
                        <%= if last_question?(@snapshot), do: "Finish Show", else: "Next Question" %>
                      </button>
                    </div>
                  </div>

                  <%# ── Host Analytics ────────────────────────────── %>
                  <%= if @snapshot.question_history && length(@snapshot.question_history || []) > 0 do %>
                    <div class="game-panel card-rise">
                      <div class="game-eyebrow--dark">Analytics</div>
                      <div style="font-size:1.1rem;font-weight:900;color:#0f172a;margin-bottom:0.85rem;">Question Results</div>
                      <div style="display:grid;gap:0.75rem;">
                        <%= for qh <- (@snapshot.question_history || []) do %>
                          <% responses = qh["responses"] || [] %>
                          <% correct_count = Enum.count(responses, & &1["is_correct"]) %>
                          <% total_count = length(responses) %>
                          <% accuracy = if total_count > 0, do: round(correct_count / total_count * 100), else: 0 %>
                          <% acc_color = if accuracy >= 70, do: "var(--success)", else: if(accuracy >= 40, do: "var(--warning)", else: "var(--primary)") %>
                          <div style="padding:0.75rem;border-radius:16px;background:var(--bg-subtle);border:1px solid var(--line);">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                              <span style="font-weight:800;font-size:0.85rem;color:var(--ink)">Q<%= qh["index"] + 1 %>: <%= String.slice(qh["text"] || "", 0, 40) %></span>
                              <span style={"font-size:0.75rem;font-weight:800;color:" <> acc_color}>
                                <%= accuracy %>% correct
                              </span>
                            </div>
                            <div style="display:grid;gap:0.25rem;">
                              <%= for resp <- responses do %>
                                <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;">
                                  <span style="width:1.25rem;text-align:center;"><%= if resp["is_correct"], do: "✅", else: "❌" %></span>
                                  <span style="flex:1;font-weight:600;color:var(--ink)"><%= resp["avatar"] || "🎮" %> <%= resp["nickname"] %></span>
                                  <span style="color:var(--muted);font-weight:700;"><%= resp["points_awarded"] || 0 %>pts</span>
                                  <span style="color:var(--faint);font-size:0.65rem;"><%= resp["response_time_ms"] || 0 %>ms</span>
                                </div>
                              <% end %>
                            </div>
                          </div>
                        <% end %>
                      </div>
                    </div>
                  <% end %>
                <% else %>
                  <%# ── Player Access ─────────────────────────────── %>
                  <div class="game-panel card-rise">
                    <div class="game-eyebrow--dark">Player Access</div>
                    <div style="font-size:1.2rem;font-weight:900;color:#0f172a;margin-bottom:0.85rem;">Get on stage</div>
                    <%= if @player_token == "" and waiting?(@snapshot) do %>
                      <form phx-submit="join" style="display:grid;gap:0.75rem;">
                        <input type="text" name="nickname" value={@nickname} placeholder="Nickname" class="game-input" />
                        <input type="text" name="avatar" value={@avatar} placeholder="Avatar emoji" class="game-input" />
                        <button type="submit" class="game-btn game-btn--blue">Join Lobby</button>
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

  # ── Event helpers ──────────────────────────────────────────────────

  defp transition(socket, callback) do
    case callback.() do
      {:ok, snapshot} ->
        {:noreply, socket |> assign(:error, nil) |> assign_snapshot(snapshot)}
      {:error, reason} ->
        {:noreply, assign(socket, :error, format_reason(reason))}
    end
  end

  defp assign_snapshot(socket, snapshot), do: assign(socket, :snapshot, snapshot)

  defp sorted_players(nil), do: []
  defp sorted_players(snapshot), do: Enum.sort_by(snapshot.players || [], &(-(&1[:score] || 0)))

  defp own_answer(nil, _player_id), do: nil
  defp own_answer(snapshot, player_id), do: Enum.find(snapshot.current_answers || [], &(&1[:player_id] == player_id))

  defp selected_answer?(nil, _player_id, _answer_id), do: false
  defp selected_answer?(snapshot, player_id, answer_id) do
    case own_answer(snapshot, player_id) do
      nil -> false
      answer -> answer[:answer_id] == answer_id
    end
  end

  defp waiting?(nil), do: false
  defp waiting?(s), do: s.status == "waiting"
  defp active?(nil), do: false
  defp active?(s), do: s.status == "active"
  defp reveal?(nil), do: false
  defp reveal?(s), do: s.status == "reveal"
  defp finished?(nil), do: false
  defp finished?(s), do: s.status == "finished"

  defp last_question?(nil), do: false
  defp last_question?(s) do
    (s.current_question_index || 0) >= max(length(get_in(s, [:quiz, :questions]) || []) - 1, 0)
  end

  defp host_controls?(nil, _ht), do: false
  defp host_controls?(_s, ht), do: ht != ""

  defp can_answer?(nil, _pid), do: false
  defp can_answer?(s, pid) do
    s.status == "active" and pid != "" and time_left(s.current_question, s.question_started_at) > 0 and
      not already_answered?(s, pid)
  end

  defp already_answered?(nil, _pid), do: false
  defp already_answered?(s, pid), do: Enum.any?(s.current_answers || [], &(&1[:player_id] == pid))

  defp time_left(nil, _sa), do: 0
  defp time_left(q, sa) do
    total = q["time_limit"] || 20
    if sa do
      elapsed = div(DateTime.diff(DateTime.utc_now(), parse_datetime(sa), :millisecond), 1000)
      max(total - elapsed, 0)
    else
      total
    end
  end

  defp parse_datetime(%DateTime{} = v), do: v
  defp parse_datetime(v) when is_binary(v) do
    case DateTime.from_iso8601(v) do
      {:ok, dt, _} -> dt
      _ -> DateTime.utc_now()
    end
  end

  # ── Class helpers ──────────────────────────────────────────────────

  defp status_class(nil), do: "waiting"
  defp status_class(s), do: s.status

  defp timer_class(t) when t <= 5, do: "game-timer--danger"
  defp timer_class(t) when t <= 10, do: "game-timer--warning"
  defp timer_class(_), do: ""

  defp answer_class(index, enabled?, selected?) do
    base = "game-answer game-answer--#{rem(index, 4) || 4}"
    cond do
      selected? -> "#{base} game-answer--selected"
      not enabled? -> "#{base} game-answer--disabled"
      true -> base
    end
  end

  defp leaderboard_class(_index, current_pid, player) do
    if player[:id] == current_pid do
      "game-leaderboard-row game-leaderboard-row--you"
    else
      "game-leaderboard-row"
    end
  end

  defp rank_class(1), do: "game-rank game-rank--gold"
  defp rank_class(2), do: "game-rank game-rank--silver"
  defp rank_class(3), do: "game-rank game-rank--bronze"
  defp rank_class(_), do: "game-rank"

  # ── Copy helpers ──────────────────────────────────────────────────

  defp status_label(nil), do: "Loading"
  defp status_label(s), do: String.upcase(s.status)

  defp stage_title(%{status: "waiting"}), do: "The lobby is warming up"
  defp stage_title(%{status: "active"}), do: "Question in play"
  defp stage_title(%{status: "reveal"}), do: "Answers on the board"
  defp stage_title(%{status: "finished"}), do: "Final standings"
  defp stage_title(_), do: "Live game"

  defp stage_eyebrow(%{status: "waiting"}), do: "Lobby"
  defp stage_eyebrow(%{status: "active"}), do: "Question"
  defp stage_eyebrow(%{status: "reveal"}), do: "Reveal"
  defp stage_eyebrow(%{status: "finished"}), do: "Results"
  defp stage_eyebrow(_), do: "Live"

  defp stage_copy(nil, _ht, _pt), do: "Connecting to the live room."
  defp stage_copy(s, ht, pt) do
    cond do
      host_controls?(s, ht) and waiting?(s) -> "You are in control. Build the room, then open the first round when the lobby feels full."
      host_controls?(s, ht) and active?(s) -> "You are running the show. Watch answer volume climb and trigger the reveal when the round peaks."
      host_controls?(s, ht) and reveal?(s) -> "The crowd has answered. Let the leaderboard breathe, then send them into the next round."
      waiting?(s) and pt == "" -> "Join the lobby, claim a nickname, and wait for the host to kick off the first question."
      waiting?(s) -> "You are in the room. Stay sharp for the opening countdown."
      active?(s) -> "Fast answers win bigger points. Lock in your choice before the timer burns out."
      reveal?(s) -> "See what the room chose, find the right answer, and watch the standings shift."
      finished?(s) -> "The game is done. Celebrate the podium, compare scores, and decide who hosts the rematch."
      true -> "Live game session connected."
    end
  end

  defp spectator_copy(s, pt) do
    cond do
      waiting?(s) and pt != "" -> "You are in. Stay here and the stage will update live."
      active?(s) and pt != "" -> "You are locked in as a player. Watch for the reveal."
      pt == "" -> "This screen follows the show live. Join before the round starts to play."
      true -> "The game is moving live. Watch the board for the next shift."
    end
  end

  defp question_progress(nil), do: "0/0"
  defp question_progress(s) do
    current = (s.current_question_index || -1) + 1
    total = length(get_in(s, [:quiz, :questions]) || [])
    if total > 0 and current > 0, do: "#{current}/#{total}", else: "0/0"
  end

  defp response_time_ms(nil), do: 0
  defp response_time_ms(s) do
    limit = s |> Map.get(:current_question, %{}) |> Map.get("time_limit", 20)
    started = Map.get(s, :question_started_at)
    if started do
      DateTime.diff(DateTime.utc_now(), parse_datetime(started), :millisecond) |> max(0) |> min(max(limit, 1) * 1000)
    else
      0
    end
  end

  defp answer_label(index), do: <<(?A + index - 1)>>

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
end
