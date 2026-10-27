using Microsoft.AspNetCore.Http;
using System.Text;
using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Identity;
using LMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LMS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Fail startup on missing/unsafe token configuration instead of silently using fallback secrets.
        services.AddOptions<JwtOptions>().Bind(configuration.GetSection(JwtOptions.Section))
            .Validate(o => Encoding.UTF8.GetByteCount(o.SigningKey) >= 32, "Jwt:SigningKey must have at least 32 bytes; use a cryptographically random secret.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Issuer) && !string.IsNullOrWhiteSpace(o.Audience), "JWT issuer and audience are required.")
            .Validate(o => o.AccessTokenMinutes is >= 1 and <= 60 && o.RefreshTokenDays is >= 1 and <= 30, "Token lifetimes are out of bounds.").ValidateOnStart();
        services.AddDbContext<ApplicationDbContext>(o => o.UseSqlServer(configuration.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("Configure ConnectionStrings:DefaultConnection."), sql => sql.EnableRetryOnFailure()));
        services.AddScoped<ILmsDbContext>(s => s.GetRequiredService<ApplicationDbContext>());
        services.AddIdentityCore<Account>(o =>
        {
            o.User.RequireUniqueEmail = true;
            o.Password.RequiredLength = 12; o.Password.RequireDigit = true; o.Password.RequireLowercase = true; o.Password.RequireUppercase = true; o.Password.RequireNonAlphanumeric = true;
            o.Lockout.MaxFailedAccessAttempts = 5; o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        }).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<ApplicationDbContext>().AddSignInManager().AddDefaultTokenProviders();
        services.AddScoped<IdentityService>();
        services.AddScoped<IAuthService>(s => s.GetRequiredService<IdentityService>());
        services.AddScoped<IUserService>(s => s.GetRequiredService<IdentityService>());
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme).Configure<IOptions<JwtOptions>>((o, options) =>
        {
            var jwt = options.Value;
            o.RequireHttpsMetadata = true; o.SaveToken = false;
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwt.Issuer,
                ValidAudience = jwt.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                ClockSkew = TimeSpan.FromSeconds(15),
                ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
            };
            o.Events = new JwtBearerEvents
            {
                // A valid JWT signature alone is insufficient after session revocation or stamp changes.
                OnTokenValidated = async context =>
                {
                    var auth = context.HttpContext.RequestServices.GetRequiredService<IAuthService>();
                    if (!await auth.ValidateSessionAsync(context.Principal!, context.HttpContext.RequestAborted)) context.Fail("Session is no longer active.");
                },
                OnChallenge = async context =>
                {
                    context.HandleResponse(); context.Response.StatusCode = 401;
                    await context.Response.WriteAsJsonAsync(new ApiResponse<object>(false, null, "Authentication is required.", TraceId: context.HttpContext.TraceIdentifier));
                },
                OnForbidden = async context =>
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsJsonAsync(new ApiResponse<object>(false, null, "You do not have permission to perform this action.", TraceId: context.HttpContext.TraceIdentifier));
                }
            };
        });
        return services;
    }
}
