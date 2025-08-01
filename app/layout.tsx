import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amas Portfolio 3D",
  description: "Amas Portfolio 3D - A showcase of my work in a 3D environment",
  openGraph: {
    title: "Amas Portfolio 3D",
    description:
      "Amas Portfolio 3D - A showcase of my work in a 3D environment",
    url: "https://amas-nghia.github.io/portfolio-3d/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
