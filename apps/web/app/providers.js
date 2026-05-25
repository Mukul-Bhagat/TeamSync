"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@vistafam/hooks";
import { ThemeProvider } from "next-themes";
export function Providers({ children }) {
    return (<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>);
}
