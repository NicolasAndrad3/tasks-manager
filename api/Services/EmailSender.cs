// api/Services/EmailSender.cs
using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace CleanTodos.Services;

/// SMTP real (não usado por padrão; Program.cs registra NullEmailSender).
public sealed class SmtpEmailSender : global::IEmailSender
{
    private readonly global::EmailSettings _cfg;
    public SmtpEmailSender(IOptions<global::EmailSettings> cfg) => _cfg = cfg.Value ?? new();

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_cfg.Host) ||
            string.IsNullOrWhiteSpace(_cfg.From))
        {
            // Sem configuração -> não envia (mantém seguro pra abrir o repo)
            return;
        }

        using var msg = new MailMessage(_cfg.From!, to, subject, body) { IsBodyHtml = false };
        using var smtp = new SmtpClient(_cfg.Host!, _cfg.Port > 0 ? _cfg.Port : 587)
        {
            EnableSsl = _cfg.EnableSsl ?? true
        };
        if (!string.IsNullOrWhiteSpace(_cfg.User))
        {
            smtp.Credentials = new NetworkCredential(_cfg.User, _cfg.Pass ?? string.Empty);
        }
        await smtp.SendMailAsync(msg, ct);
    }
}
