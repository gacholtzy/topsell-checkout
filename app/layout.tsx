import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GlobalDialogProvider } from "@/components/global/GlobalDialog";
import { getAppSettings } from "@/lib/app-settings";
import SessionGuard from "@/components/session-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Topsell Belanja",
  description: "Topsell Belanja",
};

function splitPixel(html: string) {
  // Extract all script tags (both inline and external)
  // This regex matches:
  // - <script>content</script>
  // - <script src="..."></script> (with or without content)
  // - <script src="..." />
  const scriptMatches = html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>|<script([^>]*)\s*\/>/gi);
  const scripts: Array<{ attributes: string; content: string; key: string }> = [];
  const seenKeys = new Set<string>();
  
  for (const match of scriptMatches) {
    // match[1] and match[2] are for <script>...</script> pattern
    // match[3] is for self-closing <script ... /> pattern
    const attributes = match[1] || match[3] || "";
    const content = match[2] || "";
    
    // Create a unique key to detect duplicates
    // For external scripts, use src as key
    // For inline scripts, use normalized content
    const srcMatch = attributes.match(/src=["']([^"']+)["']/i);
    let key: string;
    if (srcMatch) {
      key = `src:${srcMatch[1]}`;
    } else {
      // Use normalized content as key (remove extra whitespace)
      const normalizedContent = content.replace(/\s+/g, ' ').trim();
      key = `content:${normalizedContent}`;
    }
    
    // Skip duplicates
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      scripts.push({ attributes, content, key });
    }
  }
  
  // Extract noscript tag
  const noscriptMatch = html.match(/<noscript>([\s\S]*?)<\/noscript>/i);
  const noscript = noscriptMatch?.[1] ?? "";
  
  return { scripts, noscript }
}

function splitBodyScript(html: string) {
  // Extract all script tags from body_script (both inline and external)
  const scriptMatches = html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>|<script([^>]*)\s*\/>/gi);
  const scripts: Array<{ attributes: string; content: string; key: string }> = [];
  const seenKeys = new Set<string>();
  
  for (const match of scriptMatches) {
    const attributes = match[1] || match[3] || "";
    const content = match[2] || "";
    
    // Create a unique key to detect duplicates
    const srcMatch = attributes.match(/src=["']([^"']+)["']/i);
    let key: string;
    if (srcMatch) {
      key = `src:${srcMatch[1]}`;
    } else {
      const normalizedContent = content.replace(/\s+/g, ' ').trim();
      key = `content:${normalizedContent}`;
    }
    
    // Skip duplicates
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      scripts.push({ attributes, content, key });
    }
  }
  
  // Extract any other HTML content (non-script tags)
  const otherContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>|<script[^>]*\s*\/>/gi, '').trim();
  
  return { scripts, otherContent }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getAppSettings()
  const { scripts, noscript } = splitPixel(settings?.meta_your_pixel ?? "")
  const { scripts: bodyScripts, otherContent } = splitBodyScript(settings?.body_script ?? "")
  
  // Helper function to parse script attributes
  const parseAttributes = (attrString: string) => {
    const attrs: Record<string, string | boolean> = {};
    // Extract src, async, etc.
    const srcMatch = attrString.match(/src=["']([^"']+)["']/i);
    if (srcMatch) attrs.src = srcMatch[1];
    if (/async/i.test(attrString)) attrs.async = true;
    return attrs;
  };
  
  return (
    <html lang="en">
      <head>
        {scripts.map((script, index) => {
          const attrs = parseAttributes(script.attributes);
          // External script (has src)
          if (attrs.src) {
            return <script key={index} src={attrs.src as string} async={attrs.async as boolean} />;
          }
          // Inline script
          return <script key={index} dangerouslySetInnerHTML={{ __html: script.content }} />;
        })}
      </head>
      <body className="antialiased">
        <GlobalDialogProvider>
          <SessionGuard />
          {noscript ? <noscript dangerouslySetInnerHTML={{ __html: noscript }} /> : null}
          {bodyScripts.map((script, index) => {
            const attrs = parseAttributes(script.attributes);
            // External script (has src)
            if (attrs.src) {
              return <script key={`body-${index}`} src={attrs.src as string} async={attrs.async as boolean} />;
            }
            // Inline script
            return <script key={`body-${index}`} dangerouslySetInnerHTML={{ __html: script.content }} />;
          })}
          {otherContent ? <div dangerouslySetInnerHTML={{ __html: otherContent }} /> : null}
          {children}
          <Toaster />
        </GlobalDialogProvider>
      </body>
    </html>
  );
}
