import { NextResponse } from 'next/server';

/**
 * Proxy Route - Trung gian giữa Frontend và Google Apps Script
 * 
 * Chức năng chính:
 * 1. Ẩn URL GAS khỏi client (bảo mật)
 * 2. Tự động inject SECRET_TOKEN vào mọi request
 * 3. Bypass CORS (server-to-server call)
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const apiUrl = process.env.APPS_SCRIPT_API_URL;

    if (!apiUrl) {
      return NextResponse.json(
        { success: false, message: 'Missing APPS_SCRIPT_API_URL configuration in server environment!' },
        { status: 500 }
      );
    }

    // Gọi GAS Web App (server-to-server, không bị CORS)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      // Tự động follow redirect 302 của Google Apps Script
      redirect: 'follow',
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Apps Script returned error code: ${response.status}` },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  // Return pre-flight CORS headers if required
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
