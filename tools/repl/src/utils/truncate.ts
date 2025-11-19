export const truncate = (text: string = "", width = 8) => {
  return (
    text.slice(0, Math.floor(width / 2)) +
    "..." +
    text.slice(text.length - Math.floor(width / 2))
  );
};
