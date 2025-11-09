import clsx from "clsx";
import { useMemo } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";

type PaginationProps = {
  maxPage?: number;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
} & React.ComponentProps<"div">;

export default function Pagination({
  currentPage,
  itemsPerPage,
  totalItems,
  setCurrentPage,
  maxPage = 10,
  ...props
}: PaginationProps) {
  const pages = useMemo(
    () => Array.from({ length: maxPage }).map((_, index) => index + 1),
    [maxPage],
  );

  const canBack = useMemo(() => currentPage > 1, [currentPage]);
  const canNext = useMemo(
    () => currentPage + 1 < maxPage,
    [currentPage, maxPage],
  );

  return (
    <div
      {...props}
      className={clsx("flex items-center space-x-2", props.className)}
    >
      <button
        type="button"
        disabled={!canBack}
        className={clsx(
          "size-8 flex items-center justify-center bg-white/5 rounded hover:bg-white/10",
          canBack ? "text-gray" : "text-gray/50",
        )}
        onClick={() => {
          setCurrentPage(Math.min(currentPage - 1, 0));
        }}
      >
        <IoChevronBack size={18} />
      </button>
      <div className="flex items-center space-x-2 lt-sm:[&>:nth-child(n+2):not(:last-child)]:hidden sm:[&>:nth-child(n+4):not(:last-child)]:hidden">
        {pages.map((page, index) => {
          const selected = currentPage === page - 1;
          const showElipsis = pages.length > 1 && index === pages.length - 1;

          return (
            <div
              key={page}
              className="flex space-x-2"
            >
              {showElipsis && <div>...</div>}
              <button
                key={page}
                type="button"
                className={clsx(
                  "size-8 rounded",
                  selected
                    ? "bg-primary text-black"
                    : "bg-white/5 text-gray border border-white/10 hover:bg-white/10",
                )}
                onClick={() => setCurrentPage(page - 1)}
              >
                {page}
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!canNext}
        className={clsx(
          "size-8 flex items-center justify-center bg-white/5 rounded hover:bg-white/10",
          canNext ? "text-gray" : "text-gray/50",
        )}
        onClick={() => {
          setCurrentPage(Math.min(currentPage + 1, maxPage));
        }}
      >
        <IoChevronForward size={18} />
      </button>
    </div>
  );
}
