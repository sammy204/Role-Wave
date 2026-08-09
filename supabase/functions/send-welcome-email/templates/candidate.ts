// Candidate welcome email template.
// {{name}} is substituted with the recipient's full name at send time.
export function buildCandidateWelcomeHtml(name: string): string {
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to RoleWave</title>
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
    .stack-heading { font-size: 30px !important; }
    .step-num { font-size: 30px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EDEBE2;">
  <!-- Preheader (hidden, shows in inbox preview) -->
  <div style="display:none; max-height:0px; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#EDEBE2;">
    Your profile is 20% complete. Three steps stand between you and your first match.
    &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
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
                Account created &middot; Nigeria's talent marketplace
              </p>
              <h1 class="stack-heading" style="margin:0; font-family: Georgia, 'Times New Roman', serif; font-size:36px; line-height:1.2; font-weight:700; color:#ffffff;">
                Welcome, {{name}}.
              </h1>
              <p style="margin:14px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#D7F0E6; max-width:420px;">
                Your account exists. Your profile doesn't not yet. Here's what stands between you and your first employer match.
              </p>
            </td>
          </tr>

          <!-- 3-step sequence -->
          <tr>
            <td class="fluid-padding" style="padding: 36px 44px 8px 44px;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top" style="width:52px;">
                    <span class="step-num" style="font-family: Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#B4B2A9;">01</span>
                  </td>
                  <td valign="top" style="border-left:1px solid #D3D1C7; padding-left:18px; padding-bottom:22px;">
                    <p style="margin:2px 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#1A1A1A;">Complete your profile</p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#5F5E5A;">Skills, experience, portfolio links &mdash; the things employers actually search for.</p>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="width:52px;">
                    <span class="step-num" style="font-family: Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#B4B2A9;">02</span>
                  </td>
                  <td valign="top" style="border-left:1px solid #D3D1C7; padding-left:18px; padding-bottom:22px;">
                    <p style="margin:2px 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#1A1A1A;">Get matched with employers</p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#5F5E5A;">Verified companies browse candidate profiles directly &mdash; you don't always have to apply first.</p>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style="width:52px;">
                    <span class="step-num" style="font-family: Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; color:#B4B2A9;">03</span>
                  </td>
                  <td valign="top" style="border-left:1px solid #D3D1C7; padding-left:18px;">
                    <p style="margin:2px 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#1A1A1A;">Apply to reviewed jobs</p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#5F5E5A;">Every listing on RoleWave is checked by our team before it goes live.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary CTA -->
          <tr>
            <td class="fluid-padding" align="center" style="padding: 12px 44px 18px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:14px; background-color:#1D9E75;">
                    <a href="https://rolewave.cv/candidate" target="_blank" style="display:block; padding:15px 32px; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px; text-align:center;">
                      Complete your profile &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Secondary link + trust stamp -->
          <tr>
            <td class="fluid-padding" align="center" style="padding: 0 44px 8px 44px;">
              <p style="margin:0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#5F5E5A;">
                Not ready yet? <a href="https://rolewave.cv/jobs" target="_blank" style="color:#0F6E56; font-weight:700; text-decoration:underline;">Browse open jobs</a> first.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#E1F5EE; border:1px solid #5DCAA5; border-radius:100px;">
                <tr>
                  <td style="padding:7px 16px;">
                    <span style="font-family: Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; color:#085041;">&#10003;&nbsp; Every job reviewed before it's posted</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 30px 44px 0 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #D3D1C7; font-size:1px; line-height:1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Install instructions -->
          <tr>
            <td class="fluid-padding" style="padding: 28px 44px 4px 44px;">
              <p style="margin:0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#B4B2A9;">
                Before you go
              </p>
              <h2 style="margin:0 0 18px 0; font-family: Georgia, 'Times New Roman', serif; font-size:18px; font-weight:700; color:#1A1A1A;">
                Add RoleWave to your home screen
              </h2>
            </td>
          </tr>

          <tr>
            <td class="fluid-padding" style="padding: 0 44px 12px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D3D1C7; border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 5px 0; font-family: Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; color:#1A1A1A;">
                      iPhone &middot; Safari
                    </p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#5F5E5A;">
                      Open rolewave.cv, tap the Share icon at the bottom of the screen, then tap "Add to Home Screen."
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="fluid-padding" style="padding: 0 44px 32px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D3D1C7; border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 5px 0; font-family: Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; color:#1A1A1A;">
                      Android &middot; Chrome
                    </p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#5F5E5A;">
                      Open rolewave.cv, tap the three-dot menu in the top right, then tap "Add to Home screen."
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#EDEBE2; padding: 22px 44px;">
              <p style="margin:0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; line-height:1.6; color:#B4B2A9;">
                You're receiving this because you created a RoleWave account with this email address.
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
  return html.replace(/\{\{name\}\}/g, escapeHtml(name));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}