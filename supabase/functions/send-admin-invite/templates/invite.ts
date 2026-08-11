// Admin invite email template.
// {{inviterName}} and {{acceptUrl}} are substituted at send time.
export function buildAdminInviteHtml(inviterName: string, acceptUrl: string): string {
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>You've been invited to RoleWave admin</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #EDEBE2; }

  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 24px !important; padding-right: 24px !important; }
    .masthead-padding { padding-left: 24px !important; padding-right: 24px !important; }
    .stack-heading { font-size: 28px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EDEBE2;">
  <div style="display:none; max-height:0px; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EDEBE2;">
    ${inviterName} invited you to join the RoleWave admin team. This link expires in 7 days.
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EDEBE2;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%; background-color:#FBFAF7; border-radius:24px; overflow:hidden;">

          <!-- Masthead -->
          <tr>
            <td class="masthead-padding" style="background-color:#0F6E56; padding: 40px 44px 36px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle" style="width:30px;">
                    <img src="https://rolewave.cv/rolewave-icon.png" width="30" height="30" alt="" style="display:block; border-radius:7px;">
                  </td>
                  <td valign="middle" style="padding-left:10px;">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size:15px; font-weight:700; color:#ffffff;">RoleWave</span>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 10px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:700; letter-spacing:0.16em; text-transform:uppercase; color:#8FD4BC;">
                Admin invitation
              </p>
              <h1 class="stack-heading" style="margin:0; font-family: Georgia, 'Times New Roman', serif; font-size:32px; line-height:1.25; font-weight:700; color:#ffffff;">
                ${inviterName} added you to the admin team.
              </h1>
              <p style="margin:14px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#D7F0E6; max-width:440px;">
                This gives you access to review submissions, manage jobs, and moderate the RoleWave platform. The link below is unique to your email and expires in 7 days.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td class="fluid-padding" style="padding: 36px 44px 8px 44px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:14px; background-color:#1D9E75;">
                    <a href="${acceptUrl}" target="_blank" style="display:block; padding:15px 32px; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px; text-align:center;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#8A867E;">
                If you don't have a RoleWave account yet with this email address, this link will let you create one and grant admin access in the same step. If you weren't expecting this, you can safely ignore it — no access is granted unless the link is opened by the invited email address.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="fluid-padding" style="padding: 28px 44px 40px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5E1D8; padding-top:20px;">
                <tr>
                  <td style="padding-top:20px; font-family: Arial, Helvetica, sans-serif; font-size:12px; line-height:1.6; color:#B4B2A9;">
                    RoleWave &middot; <a href="https://rolewave.cv" target="_blank" style="color:#B4B2A9; text-decoration:underline;">rolewave.cv</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return html;
}