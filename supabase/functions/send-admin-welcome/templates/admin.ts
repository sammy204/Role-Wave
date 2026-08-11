// Admin welcome email template.
// {{name}} is substituted with the recipient's display name at send time.
export function buildAdminWelcomeHtml(name: string, adminUrl: string): string {
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to RoleWave Admin</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #EDEBE2; }
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 24px !important; padding-right: 24px !important; }
    .stack-heading { font-size: 30px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EDEBE2;">
  <div style="display:none; max-height:0px; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EDEBE2;">
    You now have the keys to RoleWave admin. Handle them with care.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDEBE2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%; background-color:#FBFAF7; border-radius:24px; overflow:hidden;">
          <tr>
            <td class="fluid-padding" style="background-color:#0F6E56; padding:40px 44px 36px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="width:30px;">
                    <img src="https://rolewave.cv/rolewave-icon.png" width="30" height="30" alt="" style="display:block; border-radius:7px;">
                  </td>
                  <td valign="middle" style="padding-left:10px;">
                    <span style="font-family:Georgia, 'Times New Roman', serif; font-size:15px; font-weight:700; color:#ffffff;">RoleWave</span>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 10px 0; font-family:Arial, Helvetica, sans-serif; font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#8FD4BC;">
                Admin access granted
              </p>
              <h1 class="stack-heading" style="margin:0; font-family:Georgia, 'Times New Roman', serif; font-size:36px; line-height:1.2; font-weight:700; color:#ffffff;">
                Welcome, {{name}}.
              </h1>
              <p style="margin:14px 0 0 0; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#D7F0E6; max-width:430px;">
                You are now part of the team trusted to keep RoleWave useful, fair, and sharp. It is a lot of responsibility, and that is exactly why the access is invite-only.
              </p>
            </td>
          </tr>

          <tr>
            <td class="fluid-padding" style="padding:36px 44px 10px 44px;">
              <p style="margin:0 0 16px 0; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.7; color:#5F5E5A;">
                As an admin, your decisions shape what candidates see, what employers trust, and how safe the marketplace feels. Review carefully, publish thoughtfully, and treat every account action like it affects a real person, because it does.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border:1px solid #D3D1C7; border-radius:16px; padding:18px;">
                    <p style="margin:0 0 8px 0; font-family:Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; color:#1A1A1A;">Your admin compass</p>
                    <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:1.7; color:#5F5E5A;">
                      Protect users. Keep listings clean. Move with context. When in doubt, slow down and ask before making a change that could affect someone's work or access.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="fluid-padding" align="center" style="padding:18px 44px 34px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:14px; background-color:#1D9E75;">
                    <a href="{{adminUrl}}" target="_blank" style="display:block; padding:15px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px; text-align:center;">
                      Open admin dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#EDEBE2; padding:22px 44px;">
              <p style="margin:0 0 6px 0; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:1.6; color:#B4B2A9;">
                You are receiving this because your email was granted RoleWave admin access.
              </p>
              <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:1.6; color:#B4B2A9;">
                RoleWave &middot; <a href="https://rolewave.cv" target="_blank" style="color:#B4B2A9; text-decoration:underline;">rolewave.cv</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return html
    .replace(/\{\{name\}\}/g, escapeHtml(name))
    .replace(/\{\{adminUrl\}\}/g, escapeHtml(adminUrl));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
