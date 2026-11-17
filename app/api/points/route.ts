import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Forward the request to the backend to get user profile/points
    const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/points/me`, {
      method: "GET",
      headers: {
        "Authorization": token
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        data || { message: "Failed to fetch user points" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching user points:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
} 