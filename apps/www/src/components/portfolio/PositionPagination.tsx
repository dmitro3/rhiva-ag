import clsx from "clsx";
import { useMemo } from "react";

import Pagination from "../Pagination";

type PositionPaginationProps = {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
} & React.ComponentProps<"div">;

export default function PositionPagination({
  currentPage,
  itemsPerPage,
  totalItems,
  setCurrentPage,
  ...props
}: PositionPaginationProps) {
  const maxPage = useMemo(
    () => Math.ceil(totalItems / itemsPerPage),
    [totalItems, itemsPerPage],
  );

  const currentStartPage = useMemo(
    () => ((currentPage + 1) * itemsPerPage + currentPage > 0 ? 1 : 0),
    [currentPage, itemsPerPage],
  );
  const currentMaxPage = useMemo(
    () => Math.min((currentPage + 1) * itemsPerPage, totalItems),
    [currentPage, itemsPerPage, totalItems],
  );

  return (
    <div
      {...props}
      className={clsx(
        "flex items-center justify-between p-2 text-sm",
        props.className,
      )}
    >
      <div className="flex-1 text-gray">
        Showing&nbsp;{currentStartPage}&nbsp;to&nbsp;{currentMaxPage}
        &nbsp;of&nbsp;{totalItems}&nbsp;positions
      </div>
      <Pagination
        maxPage={maxPage}
        currentPage={currentMaxPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  );
}
