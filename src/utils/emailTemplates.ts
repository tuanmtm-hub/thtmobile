export interface TemplateData {
  studentName?: string;
  className?: string;
  startDate?: string;
  schedule?: string;
  stopDate?: string;
  stopStatus?: string;
  reason?: string;
  oldClassName?: string;
  newClassName?: string;
  transferDate?: string;
  newSchedule?: string;
  newStatus?: string;
}

const templates = {
  welcome_class: {
    subject: "HỆ THỐNG PHÁT TRIỂN GIÁO DỤC QUỐC TẾ THT - CHÀO MỪNG HỌC VIÊN ĐẾN VỚI LỚP {{className}}",
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 40px 0; margin: 0; width: 100%;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9; max-width: 600px; width: 100%;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #21398A 0%, #152763 100%); padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Chào Mừng Học Viên Mới</h1>
            <p style="color: #93c5fd; font-size: 14px; margin: 8px 0 0 0; font-weight: 500;">Hệ Thống Phát Triển Giáo Dục Quốc Tế THT</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px 40px 32px 40px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Kính gửi Quý Phụ huynh học sinh <b>{{studentName}}</b>,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Trung tâm THT International Center xin gửi lời chào mừng nồng nhiệt nhất đến Quý Phụ huynh và học sinh khi chính thức gia nhập ngôi nhà chung THT. Chúng tôi rất vinh hạnh được đồng hành cùng gia đình trong chặng đường phát triển giáo dục sắp tới của con.
            </p>
            <p style="color: #0f172a; font-size: 15px; font-weight: 700; margin: 0 0 12px 0;">THÔNG TIN LỚP HỌC CHI TIẾT:</p>
            
            <!-- Class Info Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.6; color: #475569;">
                <tr>
                  <td style="padding: 6px 0; width: 140px; font-weight: 600; color: #64748b;">Lớp học đăng ký:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{className}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Ngày khai giảng:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{startDate}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #64748b; vertical-align: top;">Lịch học cố định:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{schedule}}</td>
                </tr>
              </table>
            </div>

            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Mọi hướng dẫn chi tiết về nội quy lớp học, giáo trình cũng như cách thức theo dõi kết quả học tập hàng ngày của con sẽ được bộ phận tư vấn gửi trực tiếp tới Quý Phụ huynh trước buổi học đầu tiên.
            </p>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; padding-top: 16px; border-top: 1px dashed #e2e8f0; font-style: italic;">
              * Lưu ý: Đây là email thông báo tự động từ hệ thống quản lý học viên THT Center, vui lòng không trả lời trực tiếp email này.
            </p>
            
            <!-- Signature -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.6; color: #334155;">
              <tr>
                <td>
                  Trân trọng,<br>
                  <strong style="color: #21398A; font-size: 15px;">Hệ Thống Phát Triển Giáo Dục Quốc Tế THT</strong><br>
                  <span style="color: #64748b; font-size: 12px;">Hotline hỗ trợ: 0931 277 200 - 0931 201 516</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },
  transfer_class: {
    subject: "HỆ THỐNG PHÁT TRIỂN GIÁO DỤC QUỐC TẾ THT - THÔNG BÁO CHUYỂN LỚP HỌC VIÊN {{studentName}}",
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 40px 0; margin: 0; width: 100%;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9; max-width: 600px; width: 100%;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Thông Báo Chuyển Lớp</h1>
            <p style="color: #bae6fd; font-size: 14px; margin: 8px 0 0 0; font-weight: 500;">Hệ Thống Phát Triển Giáo Dục Quốc Tế THT</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px 40px 32px 40px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Kính gửi Quý Phụ huynh học sinh <b>{{studentName}}</b>,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Trung tâm THT International Center xin thông báo: Học viên <b>{{studentName}}</b> đã được thực hiện điều chuyển lớp học thành công theo lộ trình học tập tối ưu nhất của con. Dưới đây là thông tin chi tiết về lớp học mới:
            </p>
            
            <!-- Class Info Card -->
            <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.6; color: #0369a1;">
                <tr>
                  <td style="padding: 6px 0; width: 140px; font-weight: 600; color: #0284c7;">Lớp học cũ:</td>
                  <td style="padding: 6px 0; color: #475569; text-decoration: line-through;">{{oldClassName}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #0284c7;">Lớp học mới:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 15px;">{{newClassName}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #0284c7;">Ngày áp dụng:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{transferDate}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #0284c7; vertical-align: top;">Lịch học lớp mới:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{newSchedule}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #0284c7;">Trạng thái học tập:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">
                    <span style="background-color: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; border: 1px solid #bae6fd;">{{newStatus}}</span>
                  </td>
                </tr>
              </table>
            </div>

            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Lịch sử kết quả học tập và số buổi học tích lũy của con tại lớp cũ sẽ được tự động đồng bộ sang lớp mới để đảm bảo quá trình đánh giá và giảng dạy của giáo viên chủ nhiệm mới diễn ra liên tục, hiệu quả nhất.
            </p>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; padding-top: 16px; border-top: 1px dashed #e2e8f0; font-style: italic;">
              * Lưu ý: Đây là email thông báo tự động từ hệ thống quản lý học viên THT Center, vui lòng không trả lời trực tiếp email này.
            </p>
            
            <!-- Signature -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.6; color: #334155;">
              <tr>
                <td>
                  Trân trọng,<br>
                  <strong style="color: #0369a1; font-size: 15px;">Hệ Thống Phát Triển Giáo Dục Quốc Tế THT</strong><br>
                  <span style="color: #64748b; font-size: 12px;">Hotline hỗ trợ: 0931 277 200 - 0931 201 516</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  },
  stop_class: {
    subject: "HỆ THỐNG PHÁT TRIỂN GIÁO DỤC QUỐC TẾ THT - XÁC NHẬN DỪNG LỚP HỌC VIÊN {{studentName}}",
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 40px 0; margin: 0; width: 100%;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9; max-width: 600px; width: 100%;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Xác Nhận Dừng Lớp</h1>
            <p style="color: #fca5a5; font-size: 14px; margin: 8px 0 0 0; font-weight: 500;">Hệ Thống Phát Triển Giáo Dục Quốc Tế THT</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 40px 40px 32px 40px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Kính gửi Quý Phụ huynh học sinh <b>{{studentName}}</b>,</p>
            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Trung tâm THT International Center xin xác nhận đã cập nhật trạng thái dừng lớp học đối với học viên <b>{{studentName}}</b> tại lớp <b>{{className}}</b> theo yêu cầu và nguyện vọng của gia đình. Thông tin chi tiết như sau:
            </p>
            
            <!-- Class Info Card -->
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.6; color: #dc2626;">
                <tr>
                  <td style="padding: 6px 0; width: 140px; font-weight: 600; color: #ef4444;">Lớp học dừng:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{className}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #ef4444;">Ngày dừng học:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">{{stopDate}}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #ef4444;">Trạng thái cập nhật:</td>
                  <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">
                    <span style="background-color: #fee2e2; color: #ef4444; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; border: 1px solid #fca5a5;">{{stopStatus}}</span>
                  </td>
                </tr>
                {{#if reason}}
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #ef4444; vertical-align: top;">Lý do / Ghi chú:</td>
                  <td style="padding: 6px 0; color: #334155; font-style: italic;">{{reason}}</td>
                </tr>
                {{/if}}
              </table>
            </div>

            <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
              Nếu đây là một đợt **Bảo lưu** hoặc **Tạm ngưng**, trung tâm sẽ lưu giữ thông tin học tập và số dư học phí còn lại (nếu có) của con trong suốt thời hạn bảo lưu theo quy chế. Bộ phận tư vấn sẽ chủ động liên hệ lại với gia đình khi con sẵn sàng quay trở lại lớp học.
            </p>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 32px 0; padding-top: 16px; border-top: 1px dashed #e2e8f0; font-style: italic;">
              * Lưu ý: Đây là email thông báo tự động từ hệ thống quản lý học viên THT Center, vui lòng không trả lời trực tiếp email này.
            </p>
            
            <!-- Signature -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; line-height: 1.6; color: #334155;">
              <tr>
                <td>
                  Trân trọng,<br>
                  <strong style="color: #dc2626; font-size: 15px;">Hệ Thống Phát Triển Giáo Dục Quốc Tế THT</strong><br>
                  <span style="color: #64748b; font-size: 12px;">Hotline hỗ trợ: 0931 277 200 - 0931 201 516</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
  }
};

export function renderLocalEmailTemplate(templateName: 'welcome_class' | 'transfer_class' | 'stop_class', data: TemplateData): { subject: string; html: string } {
  const template = templates[templateName];
  if (!template) {
    return { subject: '', html: '' };
  }

  let subject = template.subject;
  let html = template.html;

  // Handle stop_class specific conditional: {{#if reason}} ... {{/if}}
  if (templateName === 'stop_class') {
    if (data.reason && data.reason.trim() !== '') {
      html = html.replace(/\{\{#if reason\}\}([\s\S]*?)\{\{\/if\}\}/gi, '$1');
    } else {
      html = html.replace(/\{\{#if reason\}\}([\s\S]*?)\{\{\/if\}\}/gi, '');
    }
  }

  // Replace variable placeholders: {{variableName}}
  const replaceVars = (str: string) => {
    return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      const val = data[key as keyof TemplateData];
      return val !== undefined ? String(val) : '';
    });
  };

  subject = replaceVars(subject);
  html = replaceVars(html);

  return { subject, html };
}
