defmodule QuizworldRealtime.Pin do
  # Numeric-only PINs (6 digits) — unambiguous, never confused with
  # alphabetic presentation join codes or classroom codes.
  @digits String.graphemes("0123456789")

  def generate(length \\ 6) when is_integer(length) and length > 0 do
    1..length
    |> Enum.map(fn _ -> Enum.random(@digits) end)
    |> Enum.join()
  end
end
