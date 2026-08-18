// Minimal admin launch briefing email template.
// {{name}} and {{adminUrl}} are substituted at send time.
export function buildAdminWelcomeHtml(name: string, adminUrl: string): string {
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RoleWave Admin Team: Preparing for Launch</title>
<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}body{margin:0;padding:0;width:100%!important;background:#F5F7F8;}@media only screen and (max-width:600px){.email-container{width:100%!important}.fluid-padding{padding-left:24px!important;padding-right:24px!important}.stack-heading{font-size:30px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#F5F7F8;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#F5F7F8;">Important information for the RoleWave Admin Team as we prepare for launch.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7F8;"><tr><td align="center" style="padding:28px 16px 36px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
<tr><td class="fluid-padding" style="padding:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7A8491;"><span>RoleWave Admin Team</span><span style="float:right;"><a href="{{adminUrl}}" target="_blank" style="color:#65707D;text-decoration:underline;">View dashboard</a></span></td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E5E9ED;border-radius:8px;padding:42px 52px 44px;">
<div style="text-align:center;"><img src="https://rolewave.cv/rolewave-icon.png" width="48" height="48" alt="RoleWave" style="display:inline-block;border-radius:12px;vertical-align:middle;"><div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:700;letter-spacing:-.03em;color:#172238;">RoleWave</div></div>
<div style="margin-top:54px;font-family:Arial,Helvetica,sans-serif;color:#172238;">
<p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1D9E75;">Preparing for launch</p>
<h1 class="stack-heading" style="margin:0;font-size:34px;line-height:1.18;letter-spacing:-.04em;font-weight:700;color:#172238;">The work behind RoleWave.</h1>
<div style="width:66px;height:4px;margin:22px 0 30px;background:#1D9E75;border-radius:3px;"></div>
<p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#344054;">Dear {{name}},</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#4F5B6B;">Thank you for being part of the RoleWave team and for taking on the responsibility of helping us build and maintain a reliable platform for job seekers and employers.</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#4F5B6B;">Behind the scenes, our engineering team has invested significant time and care into preparing RoleWave for launch. A great deal of work has gone into building the platform, improving its reliability, strengthening security, and creating an experience that we can confidently put in the hands of our users.</p>
<p style="margin:0;font-size:15px;line-height:1.75;color:#4F5B6B;">As we move closer to launch, the role of our Admin Team becomes equally important. Engineering can build the platform, but it is the Admin Team that helps keep the platform trustworthy, organized, and useful for everyone.</p>
</div>
<div style="height:1px;margin:36px 0 30px;background:#E1E5E9;"></div>
<div style="font-family:Arial,Helvetica,sans-serif;color:#172238;">
<h2 style="margin:0 0 18px;font-size:21px;line-height:1.3;letter-spacing:-.02em;color:#172238;">Your Responsibilities as a RoleWave Admin</h2>
<ul style="margin:0;padding-left:22px;font-size:15px;line-height:1.8;color:#4F5B6B;">
<li><strong>Job Moderation:</strong> Review job postings to ensure they are legitimate, relevant, complete, and compliant with RoleWave&apos;s standards.</li>
<li><strong>Employer Review:</strong> Monitor employer accounts and flag or investigate suspicious, misleading, or potentially fraudulent activity.</li>
<li><strong>Job Quality:</strong> Help ensure that expired, duplicated, misleading, or inappropriate job listings are identified and handled appropriately.</li>
<li><strong>User Reports:</strong> Review reports submitted by users and take appropriate action when necessary.</li>
<li><strong>Platform Safety:</strong> Help identify scams, fraudulent recruitment activity, suspicious accounts, and other behavior that could put our users at risk.</li>
<li><strong>Content Management:</strong> Maintain the overall quality and professionalism of content appearing on RoleWave.</li>
<li><strong>Administrative Actions:</strong> Apply appropriate actions to jobs, employers, or users when they violate RoleWave policies.</li>
<li><strong>Escalation:</strong> Bring serious, unusual, or uncertain cases to the appropriate team rather than making high-impact decisions without review.</li>
<li><strong>Confidentiality:</strong> Treat user, employer, and platform information as confidential and only access information necessary to perform your responsibilities.</li>
<li><strong>Consistency:</strong> Apply RoleWave&apos;s policies fairly and consistently across all users and employers.</li>
</ul>
</div>
<div style="height:1px;margin:34px 0 30px;background:#E1E5E9;"></div>
<div style="border-radius:14px;background:#F0FAF6;padding:22px 24px;font-family:Arial,Helvetica,sans-serif;">
<h2 style="margin:0 0 8px;font-size:20px;color:#172238;">Our Goal</h2>
<p style="margin:0;font-size:15px;line-height:1.7;color:#4F5B6B;">The goal is simple: <strong style="color:#172238;">make RoleWave a platform that people can trust.</strong></p>
</div>
<h2 style="margin:30px 0 12px;font-size:21px;line-height:1.3;letter-spacing:-.02em;color:#172238;">Getting Started</h2>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#4F5B6B;">Please begin by reviewing the RoleWave Admin Dashboard and familiarising yourself with the job moderation, employer review, user reports, and administrative action sections.</p>
<p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#4F5B6B;">For any serious, unusual, or uncertain matter, please contact <strong style="color:#172238;">Bolarinwa</strong>.</p>
<p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#4F5B6B;">Thank you again for joining the RoleWave team. The successful launch of RoleWave will be a team effort across engineering, administration, operations, and every person contributing behind the scenes.</p>
<p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#4F5B6B;">Best regards,<br><strong style="color:#1D9E75;">The RoleWave Co-Founders</strong></p>
<div style="margin-top:32px;text-align:center;"><a href="{{adminUrl}}" target="_blank" style="display:inline-block;border-radius:7px;background:#1D9E75;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">Open admin dashboard</a></div>
</td></tr>
<tr><td class="fluid-padding" style="padding:24px 0 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8A94A1;">© 2026 RoleWave. You are receiving this email because you are part of the RoleWave admin team.</td></tr>
</table></td></tr></table>
</body></html>`;

  return html.replace(/\{\{name\}\}/g, escapeHtml(name)).replace(/\{\{adminUrl\}\}/g, escapeHtml(adminUrl));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
