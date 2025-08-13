using CleanTodos.Api.Data;
using CleanTodos.Api.Dtos;
using CleanTodos.Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase("todos"));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("vite", p => p
        .WithOrigins("http://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod());
});

var app = builder.Build();

// Middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseHttpsRedirection();
app.UseCors("vite");

// Endpoints
var todos = app.MapGroup("/api/todos").WithTags("Todos");

todos.MapGet("/", async (AppDbContext db) =>
    await db.Todos.AsNoTracking().ToListAsync());

todos.MapGet("/{id:int}", async (int id, AppDbContext db) =>
    await db.Todos.FindAsync(id) is { } t ? Results.Ok(t) : Results.NotFound());

todos.MapPost("/", async (TodoDto dto, AppDbContext db) =>
{
    var todo = new Todo { Title = dto.Title, IsDone = dto.IsDone };
    db.Todos.Add(todo);
    await db.SaveChangesAsync();
    return Results.Created($"/api/todos/{todo.Id}", todo);
});

todos.MapPut("/{id:int}", async (int id, TodoDto dto, AppDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return Results.NotFound();
    todo.Title = dto.Title;
    todo.IsDone = dto.IsDone;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

todos.MapDelete("/{id:int}", async (int id, AppDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return Results.NotFound();
    db.Todos.Remove(todo);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();

public partial class Program { } // for tests