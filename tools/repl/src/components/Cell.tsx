import { Box } from "ink";

export default function Cell({
  children,
  ...props
}: React.PropsWithChildren<React.ComponentProps<typeof Box>>) {
  return (
    <Box
      {...props}
      flexGrow={0}
      paddingX={1}
      justifyContent="flex-start"
    >
      {children}
    </Box>
  );
}
