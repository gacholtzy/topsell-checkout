/**
 * Ensures a valid token is available before making API requests
 * @param token The authentication token
 * @returns True if the token is valid, false otherwise
 */
function validateToken(token: string | null | undefined): boolean {
  if (!token) {
    console.error("No authentication token available");
    return false;
  }
  return true;
}

export interface UserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  isEmailValid: boolean;
}

export interface UserProfileResponse {
  status: number;
  message: string;
  data: UserProfile;
}

/**
 * Get the current user's profile information
 */
export async function getUserProfile(token: string): Promise<UserProfileResponse> {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch user profile");
  }

  return await response.json();
}
