import { useAuthStore } from "./useAuthStore";
import { useRouter } from "next/navigation";

/**
 * Redirect to login page with a return path
 */
export function redirectToLogin(returnPath: string, router: ReturnType<typeof useRouter>) {
  // Encode the return path to handle special characters
  const encodedPath = encodeURIComponent(returnPath);
  router.push(`/auth?from=${encodedPath}`);
}

/**
 * Check if user is authenticated, redirect to login if not
 * @param returnPath Path to return to after login
 * @param router Next.js router
 * @returns boolean indicating if user is authenticated
 */
export function requireAuth(returnPath: string, router: ReturnType<typeof useRouter>): boolean {
  const { isAuthenticated } = useAuthStore.getState();
  
  if (!isAuthenticated) {
    redirectToLogin(returnPath, router);
    return false;
  }
  
  return true;
}

/**
 * Redirect authenticated users away from pages they shouldn't access when logged in
 * @param redirectTo Path to redirect to if user is already authenticated
 * @param router Next.js router
 * @returns boolean indicating if user was redirected
 */
export function redirectAuthenticated(redirectTo: string = "/cart", router: ReturnType<typeof useRouter>): boolean {
  const { isAuthenticated } = useAuthStore.getState();
  
  if (isAuthenticated) {
    router.push(redirectTo);
    return true;
  }
  
  return false;
}

/**
 * Get redirect path from URL query parameters
 * @param defaultPath Path to redirect to if no 'from' parameter exists
 * @returns The path to redirect to
 */
export function getRedirectPath(defaultPath: string = "/"): string {
  if (typeof window === "undefined") return defaultPath;
  
  const params = new URLSearchParams(window.location.search);
  const fromPath = params.get("from");
  
  return fromPath || defaultPath;
} 