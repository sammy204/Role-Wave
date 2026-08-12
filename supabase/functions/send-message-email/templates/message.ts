// New-message email template.
// Reuses the masthead/footer/brand-token conventions from the other
// candidate-facing emails (status updates, weekly digest) so they all
// feel like the same product.

export function buildMessageEmailHtml(params: {
  name: string;
  companyName: string;
  jobTitle: string | null;
  preview: string;
  ctaUrl: string;
}): string {
  const { name, companyName, jobTitle, preview, ctaUrl } = params;
  const safeName = escapeHtml(name);
  const safeCompany = escapeHtml(companyName);
  const safePreview = escapeHtml(preview);
  const context = jobTitle ? `about ${escapeHtml(jobTitle)}` : 'to you';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>New message from ${safeCompany} — RoleWave</title>
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
    ${safeCompany} sent you a message on RoleWave.
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
                New message
              </p>
              <h1 class="stack-heading" style="margin:0; font-family: Georgia, 'Times New Roman', serif; font-size:32px; line-height:1.25; font-weight:700; color:#ffffff;">
                ${safeCompany} messaged you
              </h1>
            </td>
          </tr>

          <!-- Message preview -->
          <tr>
            <td class="fluid-padding" style="padding: 36px 44px 8px 44px;">
              <p style="margin:0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#5F5E5A;">
                Hi ${safeName}, ${safeCompany} sent you a message ${context} on RoleWave.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D3D1C7; border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 5px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#B4B2A9;">
                      ${safeCompany}
                    </p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#2C2C2A;">
                      ${safePreview}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary CTA -->
          <tr>
            <td class="fluid-padding" align="center" style="padding: 20px 44px 32px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:14px; background-color:#1D9E75;">
                    <a href="${ctaUrl}" target="_blank" style="display:block; padding:15px 32px; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px; text-align:center;">
                      Reply on RoleWave &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #D3D1C7; font-size:1px; line-height:1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#EDEBE2; padding: 22px 44px;">
              <p style="margin:0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; line-height:1.6; color:#B4B2A9;">
                You're receiving this because you have a message notification email on for your RoleWave account.
                <a href="https://rolewave.cv/candidate/settings" target="_blank" style="color:#B4B2A9; text-decoration:underline;">Manage email preferences</a>.
              </p>
              <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:11px; line-height:1.6; color:#B4B2A9;">
                RoleWave &middot; <a href="https://rolewave.cv" target="_blank" style="color:#B4B2A9; text-decoration:underline;">rolewave.cv</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`;
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}