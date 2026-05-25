import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
export const metadata = {
    title: "PipeSync - Enterprise Workspace Platform",
    description: "Modern enterprise workspace for teams",
};
export default function RootLayout({ children, }) {
    return (<html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" toastOptions={{
            style: {
                background: "rgba(10, 10, 10, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "#e5e5e5",
                backdropFilter: "blur(12px)",
            },
        }}/>
        </Providers>
      </body>
    </html>);
}
