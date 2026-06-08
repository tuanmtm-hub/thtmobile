export interface GuideItem {
  id: string;
  title: string;
  description: string;
  youtubeId: string; // Để trống nếu chưa có link
  duration: string;
  steps: string[];
  notes?: string[];
  practiceUrl?: string;
}

export interface GuideCategory {
  id: string;
  name: string;
  iconName: 'UserCheck' | 'Users' | 'GraduationCap' | 'Settings' | 'CreditCard';
  items: GuideItem[];
}

export const guidesData: GuideCategory[] = [
  {
    id: 'teachers',
    name: 'Trang Giáo Viên',
    iconName: 'UserCheck',
    items: [
      {
        id: 'teacher-overview',
        title: 'Xem danh sách & Hồ sơ giáo viên',
        description: 'Hướng dẫn cách xem, tìm kiếm, lọc danh sách giáo viên đang giảng dạy và xem chi tiết hồ sơ cá nhân.',
        youtubeId: '',
        duration: '3:45',
        steps: [
          'Bước 1: Truy cập menu "Giáo viên" ở thanh điều hướng bên trái.',
          'Bước 2: Sử dụng ô tìm kiếm ở trên cùng để tìm giáo viên theo Tên, Email hoặc Số điện thoại.',
          'Bước 3: Sử dụng các Tab phân loại (Tất cả, Đang hoạt động, Ngưng hoạt động) để lọc nhanh.',
          'Bước 4: Click vào tên hoặc dòng thông tin của giáo viên để xem chi tiết thông tin cá nhân và phân quyền.'
        ],
        notes: [
          'Trạng thái hoạt động của giáo viên sẽ quyết định việc có thể phân công dạy học hoặc điểm danh cho giáo viên đó hay không.'
        ],
        practiceUrl: '/teachers'
      },
      {
        id: 'teacher-create',
        title: 'Thêm mới giáo viên & Phân quyền',
        description: 'Quy trình khai báo tài khoản giáo viên mới vào hệ thống và thiết lập quyền hạn truy cập chức năng.',
        youtubeId: '',
        duration: '5:20',
        steps: [
          'Bước 1: Tại trang Giáo viên, nhấn nút "+ Thêm giáo viên" ở góc trên bên phải.',
          'Bước 2: Điền đầy đủ thông tin bắt buộc: Họ và tên, Email đăng nhập, Mật khẩu, Số điện thoại và Phòng ban.',
          'Bước 3: Cuộn xuống phần "Phân quyền truy cập" và tích chọn các quyền tương ứng (ví dụ: Xem lớp học, Điểm danh học sinh, Quản lý thu chi).',
          'Bước 4: Nhấn "Lưu lại" để hoàn tất. Tài khoản sẽ có hiệu lực ngay lập tức.'
        ],
        notes: [
          'Chỉ tài khoản Admin hoặc tài khoản có quyền "Quản trị hệ thống" mới được phép thêm mới và thay đổi quyền của giáo viên khác.',
          'Email của giáo viên là duy nhất và dùng để đăng nhập hệ thống, không được trùng lặp.'
        ],
        practiceUrl: '/teachers'
      },
      {
        id: 'teacher-teaching-time',
        title: 'Thống kê thời gian dạy & Tính lương',
        description: 'Cách xem thống kê số giờ dạy, ca dạy thực tế của giáo viên trong tháng để đối soát công giảng dạy.',
        youtubeId: '',
        duration: '4:10',
        steps: [
          'Bước 1: Chọn menu "Thời gian dạy" bên trái màn hình.',
          'Bước 2: Chọn khoảng thời gian cần thống kê (Từ ngày - Đến ngày) và chọn tên Giáo viên cụ thể.',
          'Bước 3: Hệ thống sẽ tổng hợp số ca đã dạy, số giờ quy đổi và danh sách các buổi điểm danh tương ứng.',
          'Bước 4: Nhấn nút "Xuất Excel" nếu cần tải bảng đối soát lương dạy của giáo viên.'
        ],
        notes: [
          'Thời gian dạy chỉ được tính khi buổi học đó đã được điểm danh hoàn tất (trạng thái Hợp lệ).'
        ],
        practiceUrl: '/teaching-time'
      }
    ]
  },
  {
    id: 'students',
    name: 'Trang Học Sinh',
    iconName: 'Users',
    items: [
      {
        id: 'student-overview',
        title: 'Quản lý hồ sơ học sinh & Tìm kiếm nhanh',
        description: 'Tổng quan giao diện quản lý học sinh, cách tra cứu thông tin liên hệ phụ huynh và tình trạng học tập.',
        youtubeId: '',
        duration: '4:05',
        steps: [
          'Bước 1: Truy cập menu "Học sinh" trên thanh menu dọc.',
          'Bước 2: Sử dụng thanh tìm kiếm thông minh để tìm học sinh theo ID, Tên học sinh, Nickname hoặc SĐT phụ huynh.',
          'Bước 3: Lọc học sinh theo các trạng thái (Đang học, Học thử, Chờ lớp, Bảo lưu, Nghỉ học).',
          'Bước 4: Click vào tên học sinh để xem nhanh lịch sử đóng học phí và các lớp học sinh đã/đang tham gia.'
        ],
        practiceUrl: '/students'
      },
      {
        id: 'student-create',
        title: 'Thêm học sinh mới & Phân lớp học',
        description: 'Các bước nhập thông tin học viên mới, cấu hình người tư vấn, nhập mã voucher và xếp lớp.',
        youtubeId: '',
        duration: '6:15',
        steps: [
          'Bước 1: Tại trang Học sinh, nhấn nút "+ Thêm học sinh".',
          'Bước 2: Nhập đầy đủ thông tin: Họ tên học sinh, Ngày sinh, Tên phụ huynh, SĐT phụ huynh (Bắt buộc).',
          'Bước 3: Chọn Trạng thái ban đầu (ví dụ: Chờ lớp hoặc Học thử), chọn Voucher giảm giá (nếu có) và Nhân viên tư vấn phụ trách.',
          'Bước 4: Nhấn "Lưu thông tin" để hoàn tất thêm hồ sơ.',
          'Bước 5: Để xếp lớp, chuyển sang trang Lớp học -> vào Chi tiết lớp -> nhấn nút "Thêm học sinh vào lớp".'
        ],
        notes: [
          'Học sinh sau khi thêm mới có thể được quản lý công nợ học phí tự động nếu đã được xếp vào lớp học có cấu hình mức phí.'
        ],
        practiceUrl: '/students'
      }
    ]
  },
  {
    id: 'classes',
    name: 'Trang Lớp Học',
    iconName: 'GraduationCap',
    items: [
      {
        id: 'class-create',
        title: 'Tạo lớp học mới & Cài đặt TKB tuần',
        description: 'Hướng dẫn thiết lập lớp học, phân công giáo viên chủ nhiệm, cấu hình học phí và lịch học cố định hàng tuần.',
        youtubeId: '',
        duration: '5:50',
        steps: [
          'Bước 1: Chọn menu "Lớp học" và nhấn nút "+ Tạo lớp học".',
          'Bước 2: Điền tên lớp, chọn Khối lớp, Nhóm lớp và chọn Giáo viên chủ nhiệm.',
          'Bước 3: Nhập mức học phí áp dụng cho lớp và ngày bắt đầu/kết thúc dự kiến.',
          'Bước 4: Tại mục "Lịch học tuần", click chọn Thứ trong tuần, Ca học và Phòng học tương ứng (có thể cấu hình nhiều buổi/tuần).',
          'Bước 5: Nhấn "Tạo lớp học" để hệ thống tạo sheet điểm danh và tự động đồng bộ thời khóa biểu.'
        ],
        notes: [
          'Lịch học tuần sau khi tạo sẽ tự động đồng bộ vào trang "Thời khóa biểu" và trang điểm danh "Lịch học hôm nay" hàng ngày.'
        ],
        practiceUrl: '/classes'
      },
      {
        id: 'class-attendance',
        title: 'Thực hiện điểm danh & Quản lý điểm danh',
        description: 'Quy trình điểm danh hàng ngày cho lớp học, chỉnh sửa trạng thái đi học, ăn uống của học sinh.',
        youtubeId: '',
        duration: '4:45',
        steps: [
          'Bước 1: Truy cập trang "Lịch học hôm nay" hoặc chọn nút "Điểm danh" trong chi tiết lớp học.',
          'Bước 2: Chọn Ngày điểm danh cần thực hiện.',
          'Bước 3: Tích chọn trạng thái đi học cho từng học sinh: Có mặt (V), Vắng có phép (P), Vắng không phép (KP), Học thử (HT).',
          'Bước 4: Cấu hình tiền ăn/phục vụ bán trú (nếu có) bằng cách chọn "Có ăn" hoặc "Không ăn".',
          'Bước 5: Điền nhận xét buổi học của từng học sinh (nếu có) và điền thông tin bài tập về nhà.',
          'Bước 6: Nhấn "Lưu điểm danh" để gửi dữ liệu lên hệ thống và gửi email thông báo tự động cho phụ huynh.'
        ],
        notes: [
          'Nút "Xóa điểm danh" chỉ hiển thị với Admin hoặc người có quyền xóa để hủy kết quả điểm danh của ngày đó.'
        ],
        practiceUrl: '/schedule'
      }
    ]
  },
  {
    id: 'settings',
    name: 'Cài Đặt Hệ Thống',
    iconName: 'Settings',
    items: [
      {
        id: 'settings-rooms-shifts',
        title: 'Quản lý Phòng học & Ca học',
        description: 'Cách khai báo thêm phòng học mới và định nghĩa các khung giờ học (ca học) cố định.',
        youtubeId: '',
        duration: '3:10',
        steps: [
          'Bước 1: Nhấp vào mục "Cài đặt hệ thống" bên thanh điều hướng trái để mở menu con.',
          'Bước 2: Chọn "Phòng học" để thêm/sửa tên các phòng học vật lý tại trung tâm.',
          'Bước 3: Chọn "Ca học" để tạo các ca học mới. Cần nhập Tên ca (ví dụ: Ca 1), Giờ bắt đầu và Giờ kết thúc.',
          'Bước 4: Nhấn nút "+" hoặc nút "Lưu" để cập nhật cấu hình.'
        ],
        notes: [
          'Nếu ca học đang được sử dụng trong thời khóa biểu của một lớp học, bạn không nên sửa giờ học quá lớn để tránh ảnh hưởng đến dữ liệu điểm danh lịch sử.'
        ]
      },
      {
        id: 'settings-holidays',
        title: 'Thiết lập Ngày nghỉ lễ & Voucher',
        description: 'Hướng dẫn cấu hình các ngày nghỉ lễ để tự động miễn điểm danh và tạo mã giảm giá học phí.',
        youtubeId: '',
        duration: '4:15',
        steps: [
          'Bước 1: Trong menu cài đặt con, chọn "Ngày nghỉ lễ". Tại đây bạn có thể thêm các dịp nghỉ lễ lớn (Tết, 30/4,...) giúp hệ thống tự trừ buổi học.',
          'Bước 2: Chọn "Voucher & giảm giá" để quản lý các chương trình ưu đãi học phí.',
          'Bước 3: Nhấp "+ Thêm voucher", điền Tên voucher, Mức giảm (theo % hoặc số tiền mặt) và thời hạn áp dụng.',
          'Bước 4: Nhấn "Lưu lại" để có thể chọn mã giảm giá này khi đăng ký hồ sơ cho học sinh.'
        ]
      }
    ]
  },
  {
    id: 'revenue',
    name: 'Quản Lý Doanh Thu',
    iconName: 'CreditCard',
    items: [
      {
        id: 'revenue-overview',
        title: 'Quản lý Thu chi & KPIs Doanh thu',
        description: 'Cách theo dõi biểu đồ tăng trưởng, xem bảng tổng hợp thu chi và các chỉ số KPI tài chính quan trọng.',
        youtubeId: '',
        duration: '5:00',
        steps: [
          'Bước 1: Vào mục "Quản lý thu chi" ở menu bên trái.',
          'Bước 2: Xem các thẻ KPI chạy số tự động hiển thị: Tổng thu, Tổng chi, Số dư thực tế và doanh số trong tháng.',
          'Bước 3: Sử dụng các bộ lọc ngày tháng và loại giao dịch (Thu học phí, Thu khác, Chi lương, Chi vận hành) để tra cứu thông tin.',
          'Bước 4: Click vào từng giao dịch để xem chi tiết biên lai.'
        ],
        practiceUrl: '/revenue'
      },
      {
        id: 'revenue-actions',
        title: 'Tạo phiếu thu chi & In biên lai học phí',
        description: 'Các bước lập phiếu thu tiền học phí của học sinh, in hóa đơn giấy hoặc xuất hóa đơn PDF gửi phụ huynh.',
        youtubeId: '',
        duration: '6:30',
        steps: [
          'Bước 1: Tại trang Quản lý thu chi, nhấn nút "+ Thu tiền" (hoặc "+ Chi tiền" đối với giao dịch chi).',
          'Bước 2: Chọn loại hình thu, chọn tên học sinh đóng phí, nhập số tiền thực thu, chọn phương thức thanh toán (Tiền mặt/Chuyển khoản).',
          'Bước 3: Nhập ghi chú chi tiết và nhấn "Xác nhận tạo".',
          'Bước 4: Sau khi lưu thành công, hệ thống hiển thị tùy chọn in biên lai. Nhấn "In biên lai" để mở hộp thoại in của máy tính.'
        ],
        notes: [
          'Khi chọn "Thu học phí", hệ thống sẽ tự động đối trừ vào công nợ hiện tại của học sinh đó trên sheet dữ liệu liên kết.'
        ],
        practiceUrl: '/revenue'
      }
    ]
  }
];
