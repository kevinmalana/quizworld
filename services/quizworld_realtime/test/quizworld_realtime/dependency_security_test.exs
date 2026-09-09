defmodule QuizworldRealtime.DependencySecurityTest do
  use ExUnit.Case, async: true

  test "Req JSON calls work through the upgraded Bandit, Finch and Mint stack" do
    plug = fn conn, _ ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      result = %{method: conn.method, body: if(body == "", do: nil, else: Jason.decode!(body))}

      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.send_resp(200, Jason.encode!(result))
    end

    server =
      start_supervised!({Bandit, plug: plug, ip: {127, 0, 0, 1}, port: 0, startup_log: false})

    {:ok, {_, port}} = ThousandIsland.listener_info(server)
    url = "http://127.0.0.1:#{port}/fixture"

    assert {:ok, %{status: 200, body: %{"method" => "GET", "body" => nil}}} = Req.get(url)

    for method <- [:post, :patch] do
      assert {:ok, %{status: 200, body: body}} =
               Req.request(method: method, url: url, json: %{fixture: "local only"})

      assert body == %{
               "method" => method |> Atom.to_string() |> String.upcase(),
               "body" => %{"fixture" => "local only"}
             }
    end
  end

  test "Req does not auto-decode archives selected by an upstream content type" do
    {:ok, {_, archive}} =
      :zip.create(~c"fixture.zip", [{~c"small.txt", "small fixture"}], [:memory])

    response =
      Req.get!(
        plug: fn conn ->
          conn
          |> Plug.Conn.put_resp_content_type("application/zip")
          |> Plug.Conn.send_resp(200, archive)
        end
      )

    assert response.body == archive
  end

  test "Req does not expand unsolicited compressed responses by default" do
    # Tiny bounded fixture: verifies the safe default, not a resource-exhaustion attack.
    compressed = :zlib.gzip("small fixture")

    response =
      Req.get!(
        plug: fn conn ->
          conn
          |> Plug.Conn.put_resp_content_type("application/octet-stream")
          |> Plug.Conn.put_resp_header("content-encoding", "gzip")
          |> Plug.Conn.send_resp(200, compressed)
        end
      )

    assert response.body == compressed
  end
end
