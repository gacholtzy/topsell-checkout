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

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const status = searchParams.get("status");

    // Forward the request to the backend to get order history
    const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/orders/history?page=${page}&limit=${limit}&status=${status}`, {
      method: "GET",
      headers: {
        "Authorization": token
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        data || { message: "Failed to fetch order history" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching order history:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
} 