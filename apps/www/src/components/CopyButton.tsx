import { format } from "util";
import { useFloating } from "@floating-ui/react";
import { MdCheckCircle, MdContentCopy } from "react-icons/md";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type CopyButtonProps = {
  content: string;
  as?: "button" | "div";
  copyIconAttrs?: React.ComponentProps<typeof MdContentCopy>;
} & React.ComponentProps<"button">;

export default function CopyButton({
  as = "button",
  content,
  children,
  copyIconAttrs,
  ...props
}: React.PropsWithChildren<CopyButtonProps>) {
  const As = as;
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-end",
  });
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const id = useMemo(() => format("#%s", content), [content]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (copied) window.setTimeout(() => setCopied(false), 5000);
  }, [copied]);

  return (
    <div className="relative">
      <As
        id={id}
        ref={refs.setReference}
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
      </As>
      {
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          className={clsx(
            "w-24 flex items-center space-x-2 bg-dark border-1 border-white/10 rounded-md p-2",
            copied ? "visible" : "invisible",
          )}
        >
          <MdCheckCircle
            size={18}
            className="text-green-500"
          />
          <span>Copied</span>
        </div>
      }
    </div>
  );
}
