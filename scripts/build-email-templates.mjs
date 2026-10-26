import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const emailTemplates = [
  {
    id: 'confirmation', route: 'confirm-sign-up', subject: 'Xác minh email của bạn | GoPinyin',
    preheader: 'Hoàn tất đăng ký tài khoản GoPinyin bằng cách xác minh email của bạn.',
    label: 'XÁC MINH TÀI KHOẢN', title: 'Xác minh email của bạn',
    message: 'Cảm ơn bạn đã tạo tài khoản GoPinyin. Vui lòng xác minh email để hoàn tất đăng ký và sử dụng tài khoản của bạn.',
    action: 'Xác minh email', notice: 'Nếu bạn không tạo tài khoản GoPinyin, bạn có thể bỏ qua email này.',
  },
  {
    id: 'recovery', route: 'reset-password', subject: 'Đặt lại mật khẩu tài khoản | GoPinyin',
    preheader: 'Bạn có thể đặt mật khẩu mới cho tài khoản GoPinyin bằng liên kết trong email này.',
    label: 'KHÔI PHỤC TÀI KHOẢN', title: 'Đặt lại mật khẩu',
    message: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu tài khoản GoPinyin của bạn. Nhấn nút bên dưới để tạo mật khẩu mới.',
    action: 'Đặt mật khẩu mới', notice: 'Nếu bạn không gửi yêu cầu này, hãy bỏ qua email. Mật khẩu hiện tại của bạn sẽ không thay đổi.',
  },
  {
    id: 'invite', route: 'invite-user', subject: 'Lời mời tạo tài khoản | GoPinyin',
    preheader: 'Bạn được mời tạo tài khoản GoPinyin. Xác nhận lời mời để tiếp tục.',
    label: 'LỜI MỜI TÀI KHOẢN', title: 'Bạn được mời tới GoPinyin',
    message: 'Bạn nhận được lời mời tạo tài khoản GoPinyin. Nhấn nút bên dưới để xác nhận lời mời và tiếp tục thiết lập tài khoản.',
    action: 'Chấp nhận lời mời', notice: 'Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email.',
  },
  {
    id: 'magic_link', route: 'magic-link-or-otp', subject: 'Liên kết đăng nhập của bạn | GoPinyin',
    preheader: 'Sử dụng liên kết bảo mật trong email để đăng nhập GoPinyin.',
    label: 'ĐĂNG NHẬP BẢO MẬT', title: 'Đăng nhập vào GoPinyin',
    message: 'Bạn vừa yêu cầu liên kết đăng nhập GoPinyin. Nhấn nút bên dưới để đăng nhập vào tài khoản của bạn.',
    action: 'Đăng nhập GoPinyin', notice: 'Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Không chuyển tiếp liên kết cho người khác.',
  },
  {
    id: 'email_change', route: 'change-email-address', subject: 'Xác nhận thay đổi email | GoPinyin',
    preheader: 'Xác nhận yêu cầu thay đổi địa chỉ email cho tài khoản GoPinyin của bạn.',
    label: 'THAY ĐỔI THÔNG TIN', title: 'Xác nhận thay đổi email',
    message: 'Chúng tôi nhận được yêu cầu thay đổi địa chỉ email cho tài khoản GoPinyin của bạn. Nhấn nút bên dưới để xác nhận yêu cầu này.',
    action: 'Xác nhận thay đổi', notice: 'Nếu bạn không yêu cầu thay đổi email, đừng nhấn nút xác nhận. Hãy kiểm tra lại tài khoản GoPinyin của bạn.',
  },
  {
    id: 'reauthentication', route: 'reauthentication', subject: 'Mã xác minh tài khoản của bạn | GoPinyin',
    preheader: 'Sử dụng mã trong email để xác minh thao tác trên tài khoản GoPinyin.',
    label: 'XÁC MINH BẢO MẬT', title: 'Mã xác minh của bạn',
    message: 'Nhập mã bên dưới tại GoPinyin để xác minh danh tính và tiếp tục thao tác bạn vừa yêu cầu.',
    token: true, notice: 'Không chia sẻ mã này với bất kỳ ai. Nếu bạn không yêu cầu mã xác minh, hãy bỏ qua email này.',
  },
];

const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function renderEmail(template) {
  const action = template.token
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#f0f7f5" style="padding:22px 12px;border:1px solid #d8e8e2;border-radius:10px;color:#123d34;font-family:Consolas,'Courier New',monospace;font-size:30px;line-height:40px;font-weight:bold;letter-spacing:5px;">{{ .Token }}</td></tr></table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="action-table"><tr><td align="center" bgcolor="#0a7868" style="border-radius:8px;mso-padding-alt:14px 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;border:1px solid #0a7868;border-radius:8px;color:#ffffff;font-size:16px;line-height:22px;font-weight:bold;text-decoration:none;text-align:center;">${escape(template.action)}</a></td></tr></table>`;
  const guidance = template.token
    ? 'Mã này chỉ dùng được một lần và sẽ hết hạn. Nếu mã không còn hiệu lực, hãy quay lại GoPinyin và gửi lại yêu cầu.'
    : 'Liên kết này chỉ dùng được một lần và sẽ hết hạn. Vui lòng mở liên kết trên cùng trình duyệt bạn đã dùng để gửi yêu cầu.';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escape(template.subject)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    @media only screen and (max-width:480px) {
      .outer { padding:20px 12px !important; }
      .content { padding:28px 24px !important; }
      .title { font-size:26px !important; line-height:34px !important; }
      .action-table { width:100% !important; }
      .action-table a { display:block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f3f6f5;font-family:Arial,Helvetica,sans-serif;color:#243b35;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:#f3f6f5;font-size:1px;line-height:1px;mso-hide:all;">${escape(template.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f6f5">
    <tr><td align="center" class="outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:560px;table-layout:fixed;border:1px solid #dfe8e3;border-radius:16px;border-collapse:separate;overflow:hidden;">
        <tr><td height="4" bgcolor="#0a7868" style="height:4px;font-size:0;line-height:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr>
        <tr><td class="content" style="padding:36px 40px 32px;">
          <img src="https://www.gopinyin.io.vn/assets/logo-full.png" width="172" height="44" alt="GoPinyin" style="display:block;width:172px;height:44px;max-width:100%;color:#0a7868;font-size:24px;font-weight:bold;" />
          <p style="margin:34px 0 12px;color:#0a7868;font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.2px;">${escape(template.label)}</p>
          <h1 class="title" style="margin:0 0 20px;color:#193b31;font-size:30px;line-height:38px;font-weight:bold;letter-spacing:-0.5px;">${escape(template.title)}</h1>
          <p style="margin:0 0 12px;font-size:16px;line-height:26px;color:#364d44;">Chào bạn,</p>
          <p style="margin:0 0 28px;font-size:16px;line-height:26px;color:#364d44;">${escape(template.message)}</p>
          ${action}
          <p style="margin:20px 0 0;font-size:14px;line-height:22px;color:#5a6e65;">${guidance}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr><td bgcolor="#f0f7f5" style="padding:16px 18px;border-left:3px solid #0a7868;border-radius:0 8px 8px 0;color:#3b554a;font-size:14px;line-height:22px;">${escape(template.notice)}</td></tr></table>
          ${template.token ? '' : `<p style="margin:28px 0 8px;color:#5a6e65;font-size:13px;line-height:21px;">Nếu nút không hoạt động, sao chép liên kết dưới đây và dán vào trình duyệt:</p>
          <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="{{ .ConfirmationURL }}" style="color:#0a7868;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">{{ .ConfirmationURL }}</a></p>`}
        </td></tr>
        <tr><td class="content" style="padding:22px 40px;border-top:1px solid #e6ede9;">
          <p style="margin:0 0 6px;font-size:13px;line-height:20px;color:#5a6e65;">Email được gửi tự động từ GoPinyin. Vui lòng không trả lời.</p>
          <a href="https://www.gopinyin.io.vn/" style="font-size:13px;line-height:20px;color:#0a7868;text-decoration:underline;">www.gopinyin.io.vn</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
`.replace(/[ \t]+$/gm, '');
}

export async function buildEmailTemplates() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const output = path.join(root, 'supabase/templates');
  await mkdir(output, { recursive: true });
  for (const template of emailTemplates) await writeFile(path.join(output, template.id + '.html'), renderEmail(template));
  await writeFile(path.join(output, 'subjects.json'), JSON.stringify(Object.fromEntries(emailTemplates.map(t => [t.id, { route: t.route, subject: t.subject }])), null, 2) + '\n');
  console.log(`[email] Generated ${emailTemplates.length} Vietnamese Supabase auth templates.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await buildEmailTemplates();
