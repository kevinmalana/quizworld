defmodule QuizworldRealtime.Pin do
  @chars "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" |> String.graphemes()

  def generate(length \\ 6) when is_integer(length) and length > 0 do
    1..length
    |> Enum.map(fn _ -> Enum.random(@chars) end)
    |> Enum.join()
  end
end
