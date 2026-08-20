defmodule QuizworldRealtime.PresentationSnapshot do
  @moduledoc """
  Shapes authoritative presentation snapshots for each client role.

  Presenter snapshots keep authoring metadata. Audience snapshots recursively
  remove answer-key fields from standalone quizzes and interactive overlays.
  """

  def from_record(record) when is_map(record) do
    slides = (fetch(record, :slides) || []) |> Enum.sort_by(&(fetch(&1, :order_index) || 0))
    settings = fetch(record, :settings) || %{}

    %{
      id: fetch(record, :id),
      creator_id: fetch(record, :creator_id),
      title: fetch(record, :title),
      status: fetch(record, :status),
      join_code: fetch(record, :join_code),
      current_slide_index: fetch(record, :current_slide_index) || 0,
      settings: settings,
      results_hidden: fetch(settings, :results_hidden) == true,
      slides: slides,
      total_slides: length(slides)
    }
  end

  def with_results_hidden(snapshot, hidden) when is_map(snapshot) and is_boolean(hidden) do
    settings = fetch(snapshot, :settings) || %{}
    updated_settings = Map.put(settings, "results_hidden", hidden)

    snapshot
    |> put_existing_style(:settings, updated_settings)
    |> put_existing_style(:results_hidden, hidden)
  end

  def for_role(snapshot, :presenter), do: snapshot
  def for_role(snapshot, _role), do: for_audience(snapshot)

  def for_audience(snapshot) when is_map(snapshot) do
    case fetch(snapshot, :slides) do
      slides when is_list(slides) ->
        put_existing_style(snapshot, :slides, Enum.map(slides, &safe_slide/1))

      _ ->
        snapshot
    end
  end

  defp safe_slide(slide) when is_map(slide) do
    content = fetch(slide, :content)

    if is_map(content) do
      put_existing_style(slide, :content, safe_content(content))
    else
      slide
    end
  end

  defp safe_slide(slide), do: slide

  defp safe_content(content) do
    content
    |> strip_answer_keys()
    |> update_interactive()
  end

  defp update_interactive(content) do
    case fetch(content, :interactive) do
      interactive when is_map(interactive) ->
        put_existing_style(content, :interactive, strip_answer_keys(interactive))

      _ ->
        content
    end
  end

  defp strip_answer_keys(content) do
    case fetch(content, :answers) do
      answers when is_list(answers) ->
        safe_answers = Enum.map(answers, &drop_correctness/1)
        put_existing_style(content, :answers, safe_answers)

      _ ->
        content
    end
  end

  defp drop_correctness(answer) when is_map(answer) do
    answer
    |> Map.delete("is_correct")
    |> Map.delete(:is_correct)
  end

  defp drop_correctness(answer), do: answer

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, Atom.to_string(key))

  defp put_existing_style(map, key, value) do
    string_key = Atom.to_string(key)

    cond do
      Map.has_key?(map, key) -> Map.put(map, key, value)
      Map.has_key?(map, string_key) -> Map.put(map, string_key, value)
      true -> Map.put(map, key, value)
    end
  end
end
