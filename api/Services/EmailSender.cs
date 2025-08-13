// api/Services/EmailSender.cs
using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace CleanTodos.Services;

public class EmailSender : IEmailSender
{
    private readonly EmailSettings _cfg;
    private readonly ILogger<EmailSender> _log;

    public EmailSender(IOptions<EmailSettings> options, ILogger<EmailSender> log)
    {
        _cfg = options.Value;
        _log = log;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_cfg.Host))
            throw new InvalidOperationException("EmailSettings.Host is not configured.");
        if (string.IsNullOrWhiteSpace(_cfg.From))
            throw new InvalidOperationException("EmailSettings.From is not configured.");

        using var client = new SmtpClient(_cfg.Host, _cfg.Port)
        {
            EnableSsl = _cfg.EnableSsl ?? true,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrWhiteSpace(_cfg.User))
        {
            client.Credentials = new NetworkCredential(_cfg.User, _cfg.Pass);
        }

        using var msg = new MailMessage
        {
            From = new MailAddress(_cfg.From),
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };
        msg.To.Add(new MailAddress(to));

        _log.LogInformation("Sending email to {To} via {Host}:{Port} (SSL={Ssl})",
            to, _cfg.Host, _cfg.Port, _cfg.EnableSsl ?? true);

        await client.SendMailAsync(msg, ct);
    }
}
