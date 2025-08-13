using System.ComponentModel.DataAnnotations;

namespace CleanTodos.Models;

public class Todo
{
    public int Id { get; set; }

    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public bool IsDone { get; set; }

    public DateTime? DueAt { get; set; }

    public int? Minutes { get; set; }

    public List<int> NotifyPlanMinutes { get; set; } = new();
}
