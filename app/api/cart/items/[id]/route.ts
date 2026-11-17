import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const token = request.headers.get("authorization");
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params if it's a Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const itemId = resolvedParams.id;

    if (!itemId || itemId === "undefined" || itemId.trim() === "") {
      return NextResponse.json(
        { message: "Item ID is required" },
        { status: 400 }
      );
    }

    const data = await request.json();
    
    // Validate required fields
    if (data.qty === undefined) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare update payload
    const updatePayload = {
      qty: data.qty
    };

    // Forward the request to the backend
    const response = await fetch(
      `${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/carts/items/${encodeURIComponent(itemId)}`, 
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token
        },
        body: JSON.stringify(updatePayload)
      }
    );

    const responseData = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        responseData || { message: "Failed to update cart item" },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error updating cart item:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const token = request.headers.get("authorization");
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params if it's a Promise (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const itemId = resolvedParams.id;

    // Validate item ID
    if (!itemId || itemId === "undefined" || itemId.trim() === "") {
      return NextResponse.json(
        { message: "Item ID is required" },
        { status: 400 }
      );
    }

    const backendUrl = `${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/carts/items/${encodeURIComponent(itemId)}`;

    // Forward the request to the backend
    const response = await fetch(backendUrl, {
      method: "DELETE",
      headers: {
        "Authorization": token
      }
    });

    // If there's no content response, return success
    if (response.status === 204) {
      return NextResponse.json(
        { message: "Cart item removed successfully" },
        { status: 200 }
      );
    }

    // Try to parse response as JSON
    let responseData;
    try {
      responseData = await response.json();
    } catch (e) {
      // If parsing fails but response is OK, return success
      if (response.ok) {
        return NextResponse.json({ 
          message: "Cart item removed successfully" 
        });
      }
    }
    
    if (!response.ok) {
      return NextResponse.json(
        responseData || { message: "Failed to remove cart item" },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error removing cart item:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
} 