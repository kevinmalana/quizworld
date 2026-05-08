defmodule QuizworldRealtimeWeb.Router do
  use QuizworldRealtimeWeb, :router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
  end

  pipeline :api do
    plug(:accepts, ["json"])
    plug(QuizworldRealtimeWeb.Plugs.RateLimit)
  end

  scope "/live", QuizworldRealtimeWeb do
    pipe_through(:browser)

    live("/game/:pin", GameLive.Show, :show)
  end

  scope "/api", QuizworldRealtimeWeb do
    pipe_through(:api)

    get("/health", HealthController, :index)
    post("/sessions", SessionController, :create)
    get("/sessions/:pin", SessionController, :show)
    post("/sessions/:pin/join", SessionController, :join)
    post("/sessions/:pin/reconnect", SessionController, :reconnect)
    post("/sessions/:pin/start", SessionController, :start)
    post("/sessions/:pin/reveal", SessionController, :reveal)
    post("/sessions/:pin/advance", SessionController, :advance)
    post("/sessions/:pin/answer", SessionController, :answer)

    get("/presentations/:id", PresentationController, :show)
    get("/presentations/:id/slides/:slide_id/activity", PresentationController, :activity)
    post("/presentations/:id/start", PresentationController, :start)
    post("/presentations/join", PresentationController, :join)
  end
end
