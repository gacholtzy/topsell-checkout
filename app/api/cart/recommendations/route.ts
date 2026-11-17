import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");

    const apiBase = process.env.API_INTERNAL_URL || "http://localhost:8080";

    // If authenticated, use cart-based recommendations; otherwise use public endpoint
    const endpoint = token
      ? `${apiBase}/api/v1/carts/recommendations`
      : `${apiBase}/api/v1/recommendations`;

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = token;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data || { message: "Failed to fetch recommendations" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}


