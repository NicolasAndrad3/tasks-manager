using System.Text.Json;
using CleanTodos.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CleanTodos.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Todo> Todos => Set<Todo>();

    private static string IntListToJson(List<int>? v)
        => JsonSerializer.Serialize(v ?? new List<int>());

    private static List<int> JsonToIntList(string? v)
        => string.IsNullOrWhiteSpace(v) ? new List<int>() :
           (JsonSerializer.Deserialize<List<int>>(v!) ?? new List<int>());

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var intListConverter = new ValueConverter<List<int>, string>(
            v => IntListToJson(v),
            v => JsonToIntList(v)
        );

        modelBuilder.Entity<Todo>(e =>
        {
            e.Property(p => p.Title).IsRequired().HasMaxLength(200);
            e.Property(p => p.NotifyPlanMinutes).HasConversion(intListConverter);
        });
    }
}
