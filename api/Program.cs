using CleanTodos.Data;
using CleanTodos.Dtos;
using CleanTodos.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;
using System.Net;
using System.Net.Mail;

var builder = WebApplication.CreateBuilder(args);

// ---------------- DB: SQLite se houver ConnectionStrings:Default; senão InMemory ----------------
var conn = builder.Configuration.GetConnectionString("Default")
           ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default");

if (!string.IsNullOrWhiteSpace(conn))
{
    // Requer Microsoft.EntityFrameworkCore.Sqlite no csproj
    builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(conn));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("TodosDb"));
}

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ---------------- CORS (Vite / Kestrel dev) ----------------
builder.Services.AddCors(o =>
{
    o.AddPolicy("dev", p => p
        .WithOrigins(
            "http://localhost:5173",
            "https://localhost:5173",
            "http://localhost:7043",
            "https://localhost:7043"
        )
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// ---------------- Email (registro condicional seguro) ----------------
var emailSection = builder.Configuration.GetSection("Email");
builder.Services.Configure<EmailSettings>(emailSection);

var hasHost = !string.IsNullOrWhiteSpace(emailSection["Host"]);
var hasFrom = !string.IsNullOrWhiteSpace(emailSection["From"]);
if (hasHost && hasFrom)
{
    // Envia e-mail REAL se houver configuração
    builder.Services.AddSingleton<IEmailSender, EmailSender>();
}
else
{
    // No-op: apenas loga. Seguro para dev/CI sem segredos.
    builder.Services.AddSingleton<IEmailSender, NullEmailSender>();
}

// ---------------- Hosted Service (scheduler simples) ----------------
builder.Services.AddHostedService<NotificationScheduler>();

var app = builder.Build();

app.UseCors("dev");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Health ping simples
app.MapGet("/", () => Results.Ok(new { ok = true }));

var group = app.MapGroup("/api/todos");

// ---------------- Helpers ----------------
static DateTime? ToUtc(DateTime? dt)
{
    if (dt is null) return null;
    var v = dt.Value;
    if (v.Kind == DateTimeKind.Utc) return v;
    if (v.Kind == DateTimeKind.Unspecified) v = DateTime.SpecifyKind(v, DateTimeKind.Local);
    return v.ToUniversalTime();
}

// ---------------- Endpoints ----------------

// GET all
group.MapGet("/", async (AppDbContext db) =>
{
    var items = await db.Todos.AsNoTracking().OrderBy(t => t.Id).ToListAsync();
    return Results.Ok(items);
});

// GET by id
group.MapGet("/{id:int}", async Task<Results<Ok<Todo>, NotFound>> (int id, AppDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    return todo is null ? TypedResults.NotFound() : TypedResults.Ok(todo);
});

// POST
group.MapPost("/", async Task<Created<Todo>> (TodoDto dto, AppDbContext db) =>
{
    var todo = new Todo
    {
        Title = dto.Title,
        IsDone = dto.IsDone,
        DueAt = ToUtc(dto.DueAt),
        Minutes = dto.Minutes,
        NotifyPlanMinutes = dto.NotifyPlanMinutes ?? new List<int>()
        // Se você adicionar `NotifyEmail` no modelo/DTO, mapeie aqui:
        // NotifyEmail = dto.NotifyEmail
    };

    db.Todos.Add(todo);
    await db.SaveChangesAsync();

    return TypedResults.Created($"/api/todos/{todo.Id}", todo);
});

// PUT
group.MapPut("/{id:int}", async Task<Results<NoContent, NotFound>> (int id, TodoDto dto, AppDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return TypedResults.NotFound();

    todo.Title = dto.Title;
    todo.IsDone = dto.IsDone;
    todo.DueAt = ToUtc(dto.DueAt);
    todo.Minutes = dto.Minutes;
    todo.NotifyPlanMinutes = dto.NotifyPlanMinutes ?? new List<int>();
    // Se `NotifyEmail` existir no DTO:
    // todo.NotifyEmail = dto.NotifyEmail;

    await db.SaveChangesAsync();
    return TypedResults.NoContent();
});

// DELETE
group.MapDelete("/{id:int}", async Task<Results<NoContent, NotFound>> (int id, AppDbContext db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return TypedResults.NotFound();

    db.Todos.Remove(todo);
    await db.SaveChangesAsync();
    return TypedResults.NoContent();
});

app.Run();

// Necessário para WebApplicationFactory nos testes
public partial class Program { }

// ======================================================================
//  Email infra
// ======================================================================
public record EmailSettings
{
    public string? Host { get; init; }
    public int Port { get; init; } = 587;
    public string? User { get; init; }
    public string? Pass { get; init; }
    public string? From { get; init; }
    public bool? EnableSsl { get; init; } = true;
}

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct = default);
}

// No-op: apenas loga (seguro p/ dev/CI)
public class NullEmailSender : IEmailSender
{
    private readonly ILogger<NullEmailSender> _log;
    public NullEmailSender(ILogger<NullEmailSender> log) => _log = log;

    public Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        _log.LogInformation("EMAIL (stub) to={To} subject={Subject} body={Body}", to, subject, body);
        return Task.CompletedTask;
    }
}

// SMTP real — usado somente se Email:Host e Email:From estiverem configurados
public class EmailSender : IEmailSender
{
    private readonly EmailSettings _cfg;
    private readonly ILogger<EmailSender> _log;

    public EmailSender(IOptions<EmailSettings> options, ILogger<EmailSender> log)
    {
        _cfg = options.Value ?? new EmailSettings();
        _log = log;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_cfg.Host) || string.IsNullOrWhiteSpace(_cfg.From))
        {
            _log.LogWarning("Email settings missing. Falling back to no-op.");
            return;
        }

        using var msg = new MailMessage
        {
            From = new MailAddress(_cfg.From!),
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };
        msg.To.Add(new MailAddress(to));

        using var client = new SmtpClient(_cfg.Host!, _cfg.Port > 0 ? _cfg.Port : 587)
        {
            EnableSsl = _cfg.EnableSsl ?? true
        };

        if (!string.IsNullOrWhiteSpace(_cfg.User) && !string.IsNullOrWhiteSpace(_cfg.Pass))
        {
            client.Credentials = new NetworkCredential(_cfg.User, _cfg.Pass);
        }

        await client.SendMailAsync(msg, ct);
        _log.LogInformation("Email sent to {To} subject={Subject}", to, subject);
    }
}

// ======================================================================
//  Hosted Service: varredura a cada 60s + de-dupe por (todoId, offset).
//  Interpreta NotifyPlanMinutes como "X minutos ANTES do DueAt".
//  Se houver propriedade string NotifyEmail no modelo, envia.
// ======================================================================
public class NotificationScheduler : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<NotificationScheduler> _log;
    private readonly IEmailSender _email;

    // guarda envios feitos para não repetir
    private readonly ConcurrentDictionary<string, DateTime> _sent = new();

    public NotificationScheduler(IServiceProvider sp, ILogger<NotificationScheduler> log, IEmailSender email)
    {
        _sp = sp;
        _log = log;
        _email = email;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _log.LogInformation("NotificationScheduler started");
        var timer = new PeriodicTimer(TimeSpan.FromSeconds(60));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var nowUtc = DateTime.UtcNow;
                var windowStart = nowUtc.AddMinutes(-1); // janela de 1 min

                var todos = await db.Todos
                    .AsNoTracking()
                    .Where(t => t.DueAt != null && t.NotifyPlanMinutes.Count > 0)
                    .ToListAsync(stoppingToken);

                foreach (var t in todos)
                {
                    // tenta ler propriedade NotifyEmail (se existir no modelo)
                    var notifyEmail = t.GetType().GetProperty("NotifyEmail")?.GetValue(t) as string;

                    foreach (var off in t.NotifyPlanMinutes.Distinct())
                    {
                        // offset é "X minutos ANTES"
                        var when = t.DueAt!.Value.AddMinutes(-off);
                        if (when <= nowUtc && when > windowStart)
                        {
                            var key = $"{t.Id}:{off}:{when:yyyyMMddHHmm}";
                            if (_sent.ContainsKey(key)) continue;

                            var subject = $"Reminder: \"{t.Title}\" in {off} minute(s)";
                            var timeLocal = t.DueAt!.Value.ToLocalTime().ToString("t");
                            var dateLocal = t.DueAt!.Value.ToLocalTime().ToString("d");
                            var body = $"Event \"{t.Title}\" starts at {timeLocal} on {dateLocal}. That's in {off} minute(s).";

                            if (!string.IsNullOrWhiteSpace(notifyEmail))
                            {
                                await _email.SendAsync(notifyEmail!, subject, body, stoppingToken);
                                _log.LogInformation("Notification sent (TodoId={Id}, offset={Off}m) to {Email}", t.Id, off, notifyEmail);
                            }
                            else
                            {
                                _log.LogInformation("Notification ready (no email set) TodoId={Id} Title='{Title}'", t.Id, t.Title);
                            }

                            _sent.TryAdd(key, nowUtc);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "NotificationScheduler tick failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }

        _log.LogInformation("NotificationScheduler stopped");
    }
}
