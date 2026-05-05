defmodule QuizworldRealtimeWeb do
  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]
      import Plug.Conn
      alias QuizworldRealtimeWeb.Router.Helpers, as: Routes
    end
  end

  def router do
    quote do
      use Phoenix.Router
      import Phoenix.LiveView.Router
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def live_view do
    quote do
      use Phoenix.LiveView, layout: false
      unquote(html_helpers())
    end
  end

  defp html_helpers do
    quote do
      use Phoenix.Component
      import Phoenix.HTML
      import Phoenix.LiveView.Helpers
      alias Phoenix.LiveView.JS
    end
  end

  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
