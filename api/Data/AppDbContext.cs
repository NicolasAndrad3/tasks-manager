using CleanTodos.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace CleanTodos.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Todo> Todos => Set<Todo>();
}