import { useState, useEffect, useMemo } from 'react';

/**
 * usePagination - Hook phân trang dùng chung cho tất cả trang
 *
 * @param data - Mảng dữ liệu đã được lọc (filteredList)
 * @param itemsPerPage - Số dòng tối đa mỗi trang (mặc định: 10)
 * @param resetDeps - Danh sách dependencies khi thay đổi sẽ reset về trang 1
 *
 * @returns {object}
 * - paginatedData: Dữ liệu slice của trang hiện tại
 * - currentPage: Trang hiện tại
 * - totalPages: Tổng số trang
 * - startIndex: Chỉ số bắt đầu (dùng cho "Hiển thị từ X đến Y")
 * - setCurrentPage: Hàm chuyển trang thủ công
 * - getPageNumbers: Hàm trả về danh sách số trang (có "..." rút gọn)
 */
export function usePagination<T>(
  data: T[],
  itemsPerPage: number = 10,
  resetDeps: any[] = []
) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reset về trang 1 mỗi khi bộ lọc / tìm kiếm thay đổi
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDeps);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  const paginatedData = useMemo(
    () => data.slice(startIndex, startIndex + itemsPerPage),
    [data, startIndex, itemsPerPage]
  );

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, '...', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  return {
    paginatedData,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  };
}
