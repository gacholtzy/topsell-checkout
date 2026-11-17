import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.productId || data.qty === undefined) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Format the request body according to the backend API
    const cartItem = {
      productId: data.productId,
      variationId: data.variationId || "",
      qty: data.qty
    };

    // Forward the request to the backend
    const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/carts/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify(cartItem)
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        responseData || { message: "Failed to add item to cart" },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error adding item to cart:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Forward the request to the backend to get cart items
    const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/carts`, {
      method: "GET",
      headers: {
        "Authorization": token
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(
        data || { message: "Failed to fetch cart" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching cart:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Forward the request to the backend to clear the cart
    const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:8080'}/api/v1/carts`, {
      method: "DELETE",
      headers: {
        "Authorization": token
      }
    });

    // If there's no content response, return success
    if (response.status === 204) {
      return NextResponse.json(
        { message: "Cart cleared successfully" },
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
          message: "Cart cleared successfully" 
        });
      }
    }
    
    if (!response.ok) {
      return NextResponse.json(
        responseData || { message: "Failed to clear cart" },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error clearing cart:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
} 