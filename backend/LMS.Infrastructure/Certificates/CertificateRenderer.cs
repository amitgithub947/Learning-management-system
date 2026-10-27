using LMS.Application;
using Microsoft.Extensions.Configuration;
using PdfSharp;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;
namespace LMS.Infrastructure.Certificates;

/// <summary>Renders certificate snapshots using embedded fonts and an explicit display timezone.</summary>
public sealed class CertificateRenderer : ICertificateRenderer
{
    // PDFsharp font configuration is process-wide; guard resolver initialization across concurrent renders.
    private static readonly object FontLock = new();
    private readonly TimeZoneInfo timeZone;
    public CertificateRenderer(IConfiguration configuration) { timeZone = TimeZoneInfo.FindSystemTimeZoneById(configuration["Certificates:DisplayTimeZone"] ?? "UTC"); lock (FontLock) { GlobalFontSettings.FontResolver ??= new CertificateFontResolver(); } }
    public byte[] Render(CertificateDto c)
    {
        using var doc = new PdfDocument(); doc.Info.Title = $"Certificate - {c.CourseTitle}"; doc.Info.Author = "Learnwell";
        var page = doc.AddPage(); page.Size = PageSize.A4; page.Orientation = PageOrientation.Landscape;
        using var g = XGraphics.FromPdfPage(page); var width = page.Width.Point; var height = page.Height.Point;
        var ink = XColor.FromArgb(32, 40, 65); var blue = XColor.FromArgb(68, 80, 214); var muted = XColor.FromArgb(115, 125, 149); var pale = XColor.FromArgb(248, 249, 255);
        g.DrawRectangle(new XSolidBrush(pale), 0, 0, width, height);
        g.DrawRectangle(new XPen(XColor.FromArgb(219, 224, 245), 1), 24, 24, width - 48, height - 48);
        g.DrawRectangle(new XSolidBrush(blue), 24, 24, 8, height - 48);
        g.DrawLine(new XPen(blue, 2), 64, 73, 106, 73);
        Text("learnwell.", 18, 128, 61, ink, true); Text("C E R T I F I C A T E   O F   C O M P L E T I O N", 12, 64, 111, blue, true);
        Center("A little progress. A lasting achievement.", 29, 160, ink, true);
        Center("This certificate is proudly presented to", 12, 215, muted);
        FitCenter(c.StudentName, 35, 249, ink, 660, true);
        g.DrawLine(new XPen(XColor.FromArgb(210, 216, 237), 1), width / 2 - 140, 300, width / 2 + 140, 300);
        Center("for successfully completing the requirements of", 12, 320, muted);
        // Course titles and names are fitted to a bounded, fixed one-page layout.
        FitCenter(c.CourseTitle, 24, 350, blue, 680, true);
        Center($"Completed on {TimeZoneInfo.ConvertTime(c.CompletedAt, timeZone):dd MMMM yyyy} ({timeZone.Id})", 12, 394, muted);
        g.DrawLine(new XPen(XColor.FromArgb(218, 223, 241), 1), 64, 442, width - 64, 442);
        Text("COURSE TRAINER", 8, 64, 464, muted, true); FitLeft(c.TrainerName, 12, 64, 482, ink, 290, true);
        Text("CERTIFICATE NUMBER", 8, width / 2 + 20, 464, muted, true); Text(c.CertificateNumber, 11, width / 2 + 20, 482, ink, true);
        Text("VERIFICATION CODE", 8, 64, 519, muted, true); Text(c.VerificationCode, 9, 64, 535, ink);
        Text("Verify this achievement on the Learnwell certificate verification page.", 9, width / 2 + 20, 535, muted);
        using var output = new MemoryStream(); doc.Save(output, false); return output.ToArray();
        void Text(string text, double size, double x, double y, XColor color, bool bold = false) => g.DrawString(text, new XFont("Lato", size, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular), new XSolidBrush(color), new XPoint(x, y));
        void Center(string text, double size, double y, XColor color, bool bold = false) => g.DrawString(text, new XFont("Lato", size, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular), new XSolidBrush(color), new XRect(50, y, width - 100, 40), XStringFormats.TopCenter);
        void FitCenter(string text, double size, double y, XColor color, double max, bool bold)
        {
            text = string.Join(" ", text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            if (g.MeasureString(text, new XFont("Lato", size, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular)).Width <= max) { Center(text, size, y, color, bold); return; }
            size = Math.Min(size, size >= 30 ? 22 : 17); List<string> lines;
            do
            {
                var font = new XFont("Lato", size, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular); lines = []; var line = "";
                foreach (var rune in text.EnumerateRunes()) { var candidate = line + rune.ToString(); if (g.MeasureString(candidate, font).Width > max && line.Length > 0) { lines.Add(line.Trim()); line = rune.ToString(); } else line = candidate; }
                if (line.Length > 0) lines.Add(line.Trim()); if (lines.Count <= 2) break; size -= .5;
            } while (size > 1);
            for (var i = 0; i < lines.Count; i++) Center(lines[i], size, y + i * (size + 3), color, bold);
        }
        void FitLeft(string text, double size, double x, double y, XColor color, double max, bool bold) { while (g.MeasureString(text, new XFont("Lato", size, bold ? XFontStyleEx.Bold : XFontStyleEx.Regular)).Width > max && size > 7) size -= .5; Text(text, size, x, y, color, bold); }
    }
}
internal sealed class CertificateFontResolver : IFontResolver
{
    public FontResolverInfo ResolveTypeface(string familyName, bool bold, bool italic) => new(bold ? "Lato-Bold" : "Lato-Regular");
    public byte[] GetFont(string faceName)
    {
        using var stream = typeof(CertificateFontResolver).Assembly.GetManifestResourceStream($"LMS.Infrastructure.Certificates.Fonts.{faceName}.ttf") ?? throw new InvalidOperationException("Certificate font resource missing.");
        using var output = new MemoryStream(); stream.CopyTo(output); return output.ToArray();
    }
}
