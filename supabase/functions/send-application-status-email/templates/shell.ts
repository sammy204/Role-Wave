// Shared shell for application status-change emails.
// Reuses the masthead/footer visual language from the candidate welcome
// email (send-welcome-email/templates/candidate.ts) so the two feel like
// the same product. Only the body content varies per status.

export type ApplicationStatus =
  | 'reviewed'
  | 'shortlisted'
  | 'interview'
  | 'offer'
  | 'hired'
  | 'rejected';

interface StatusCopy {
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel: string;
  badgeText: string;
}

export interface OfferDetails {
  roleTitle: string;
  compensation: string;
  startDate: string | null;
  workArrangement: string | null;
  location: string | null;
  expiryDate: string | null;
  benefitsNotes: string | null;
}

const STATUS_COPY: Record<ApplicationStatus, (jobTitle: string, companyName: string) => StatusCopy> = {
  reviewed: (job, company) => ({
    eyebrow: 'Application update',
    heading: 'Your application is under review',
    body: `${company} has started reviewing your application for ${job}. No action is needed from you right now — we'll email you again as soon as there's movement.`,
    ctaLabel: 'View application',
    badgeText: 'Under review',
  }),
  shortlisted: (job, company) => ({
    eyebrow: 'Application update',
    heading: "You've been shortlisted",
    body: `Good news — ${company} has shortlisted your application for ${job}. You're a step closer to an interview.`,
    ctaLabel: 'View application',
    badgeText: 'Shortlisted',
  }),
  interview: (job, company) => ({
    eyebrow: 'Application update',
    heading: "You're invited to interview",
    body: `${company} would like to move forward with an interview for ${job}. They may reach out directly, or you can message them from RoleWave to coordinate.`,
    ctaLabel: 'View application',
    badgeText: 'Interview stage',
  }),
  offer: (job, company) => ({
    eyebrow: 'Application update',
    heading: "You've received an offer",
    body: `${company} has extended an offer for ${job}. The details are below — head to RoleWave to accept or decline.`,
    ctaLabel: 'View offer',
    badgeText: 'Offer extended',
  }),
  hired: (job, company) => ({
    eyebrow: 'Application update',
    heading: 'Congratulations — you got the role',
    body: `${company} has confirmed you for ${job}. Welcome to the team.`,
    ctaLabel: 'View application',
    badgeText: 'Hired',
  }),
  rejected: (job, company) => ({
    eyebrow: 'Application update',
    heading: 'An update on your application',
    body: `${company} has decided not to move forward with your application for ${job} at this time.`,
    ctaLabel: 'View application',
    badgeText: 'Not selected',
  }),
};

export function buildStatusEmailHtml(params: {
  name: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  rejectionReason?: string | null;
  offerDetails?: OfferDetails | null;
  ctaUrl: string;
}): string {
  const { name, jobTitle, companyName, status, rejectionReason, offerDetails, ctaUrl } = params;
  const copy = STATUS_COPY[status](escapeHtml(jobTitle), escapeHtml(companyName));

  const reasonBlock =
    status === 'rejected' && rejectionReason && rejectionReason.trim()
      ? `
          <tr>
            <td class="fluid-padding" style="padding: 0 44px 8px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #D3D1C7; border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 5px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#B4B2A9;">
                      Feedback from ${escapeHtml(companyName)}
                    </p>
                    <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#5F5E5A;">
                      ${escapeHtml(rejectionReason.trim())}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const offerBlock =
    status === 'offer' && offerDetails
      ? `
          <tr>
            <td class="fluid-padding" style="padding: 0 44px 8px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #8FD3E8; background-color:#E3F5FB; border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px 0; font-family: Arial, Helvetica, sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#0B5C73;">
                      Offer details
                    </p>
                    ${offerDetailRow('Role', escapeHtml(offerDetails.roleTitle))}
                    ${offerDetailRow('Compensation', escapeHtml(offerDetails.compensation))}
                    ${offerDetails.workArrangement ? offerDetailRow('Work arrangement', escapeHtml(offerDetails.workArrangement) + (offerDetails.location ? ` &middot; ${escapeHtml(offerDetails.location)}` : '')) : ''}
                    ${offerDetails.startDate ? offerDetailRow('Start date', escapeHtml(offerDetails.startDate)) : ''}
                    ${offerDetails.expiryDate ? offerDetailRow('Offer expires', escapeHtml(offerDetails.expiryDate)) : ''}
                    ${offerDetails.benefitsNotes ? `<p style="margin:10px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size:13px; line-height:1.6; color:#0B5C73; white-space:pre-wrap;">${escapeHtml(offerDetails.benefitsNotes)}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${copy.heading} — RoleWave</title>
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
    ${escapeHtml(copy.body.slice(0, 100))}
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
                ${escapeHtml(copy.eyebrow)}
              </p>
              <h1 class="stack-heading" style="margin:0; font-family: Georgia, 'Times New Roman', serif; font-size:32px; line-height:1.25; font-weight:700; color:#ffffff;">
                ${escapeHtml(copy.heading)}
              </h1>
            </td>
          </tr>

          <!-- Status badge + body -->
          <tr>
            <td class="fluid-padding" style="padding: 36px 44px 8px 44px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#E1F5EE; border:1px solid #5DCAA5; border-radius:100px; margin-bottom:20px;">
                <tr>
                  <td style="padding:7px 16px;">
                    <span style="font-family: Arial, Helvetica, sans-serif; font-size:12px; font-weight:700; color:#085041;">${escapeHtml(copy.badgeText)}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; color:#1A1A1A;">
                ${jobTitle} &middot; ${companyName}
              </p>
              <p style="margin:0; font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.6; color:#5F5E5A;">
                Hi ${escapeHtml(name)}, ${copy.body}
              </p>
            </td>
          </tr>
${reasonBlock}${offerBlock}
          <!-- Primary CTA -->
          <tr>
            <td class="fluid-padding" align="center" style="padding: 20px 44px 32px 44px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:14px; background-color:#1D9E75;">
                    <a href="${ctaUrl}" target="_blank" style="display:block; padding:15px 32px; font-family: Arial, Helvetica, sans-serif; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px; text-align:center;">
                      ${escapeHtml(copy.ctaLabel)} &rarr;
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
                You're receiving this because you applied to a job on RoleWave. You can turn off application update emails anytime in Settings.
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

function offerDetailRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
      <tr>
        <td style="font-family: Arial, Helvetica, sans-serif; font-size:13px; color:#0B5C73; opacity:0.75;">${escapeHtml(label)}</td>
        <td align="right" style="font-family: Arial, Helvetica, sans-serif; font-size:13px; font-weight:700; color:#0B5C73;">${value}</td>
      </tr>
    </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}