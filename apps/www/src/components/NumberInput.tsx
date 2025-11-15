import { useEffect, useState } from "react";
import { MdAdd } from "react-icons/md";
import { FiMinus } from "react-icons/fi";

type NumberInputProps = {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
} & Omit<React.ComponentProps<"div">, "onChange">;

export default function NumberInput({
  label,
  value,
  step,
  onChange,
}: NumberInputProps) {
  const [inputValue, setInputValue] = useState<string | number>(
    value.toPrecision(6),
  );

  useEffect(() => {
    setInputValue(value.toPrecision(6));
  }, [value]);

  return (
    <div className="flex-1 flex flex-col space-y-2">
      <p className="text-light-secondary lt-sm:text-xs">{label}</p>
      <div className="flex items-center px-2 border border-white/20 rounded-md focus-within:border-primary">
        <button
          type="button"
          className="size-4 flex items-center justify-center bg-white/50 text-black rounded"
          onClick={() => {
            const newValue = value + step;

            onChange(newValue);
            setInputValue(newValue.toPrecision(6));
          }}
        >
          <MdAdd size={18} />
        </button>
        <input
          value={inputValue}
          placeholder="0"
          className="w-full p-2 text-center"
          onChange={(event) => {
            const raw = event.target.value;
            const value = parseFloat(event.target.value);
            setInputValue(raw);
            if (!Number.isNaN(value)) onChange(value);
          }}
        />
        <button
          type="button"
          className="size-4 flex items-center justify-center bg-white/50 text-black rounded"
          onClick={() => {
            const newValue = value - step;
            onChange(newValue);
            setInputValue(newValue.toPrecision(6));
          }}
        >
          <FiMinus size={18} />
        </button>
      </div>
    </div>
  );
}
