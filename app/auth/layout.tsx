import AuthGuard from "@/components/global/AuthGuard";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}