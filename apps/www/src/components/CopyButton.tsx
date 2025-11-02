import { format } from "util";
import { MdCheckCircle, MdContentCopy } from "react-icons/md";
import { useEffect, useMemo, useRef, useState } from "react";

type CopyButtonProps = {
  content: string;
  copyIconAttrs?: React.ComponentProps<typeof MdContentCopy>;
} & React.ComponentProps<"button">;

export default function CopyButton({
  content,
  children,
  copyIconAttrs,
  ...props
}: React.PropsWithChildren<CopyButtonProps>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const id = useMemo(() => format("#%s", content), [content]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (copied) window.setTimeout(() => setCopied(false), 5000);
  }, [copied]);

  return (
    <div className="relative">
      <button
        id={id}
        type="button"
        className={props.className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          setCopied(false);
          navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
          });
        }}
      >
        <MdContentCopy
          size={16}
          {...copyIconAttrs}
        />
        {children}
      </button>
      {copied && (
        <div className="w-24 absolute inset-x-0 flex items-center space-x-2 bg-dark border-1 border-white/10 rounded-md p-2 animate-bounce-in">
          <MdCheckCircle
            size={18}
            className="text-green-500"
          />
          <span>Copied</span>
        </div>
      )}
    </div>
  );
}
