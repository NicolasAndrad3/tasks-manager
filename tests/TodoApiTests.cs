using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public class TodoApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public TodoApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_And_List_Todos()
    {
        var create = await _client.PostAsJsonAsync("/api/todos", new { title = "test from CI", isDone = false });
        create.EnsureSuccessStatusCode();

        var list = await _client.GetAsync("/api/todos");
        list.EnsureSuccessStatusCode();

        var body = await list.Content.ReadAsStringAsync();
        Assert.Contains("test from CI", body);
    }
}
