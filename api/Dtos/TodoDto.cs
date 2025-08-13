namespace CleanTodos.Dtos;

public record TodoDto(
    string Title,
    bool IsDone,
    DateTime? DueAt,
    int? Minutes,
    List<int>? NotifyPlanMinutes
);
