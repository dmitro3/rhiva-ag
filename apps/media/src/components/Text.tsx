export default <T extends React.ElementType>({
  children,
  as = "p",
  ...props
}: React.ComponentProps<T> & React.PropsWithChildren & { as?: T }) => {
  const As = as;
  return (
    <As
      {...props}
      style={{ fontFamily: "Roboto", ...props.style, margin: 0 }}
    >
      {children}
    </As>
  );
};
