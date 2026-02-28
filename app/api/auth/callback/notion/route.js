import { NextResponse } from "next/server";

export async function GET(request) {
  // 1. URL에서 "code"라는 임시 번호표를 꺼냅니다.
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // 에러가 있거나 코드가 없으면 중단
  if (error || !code) {
    return NextResponse.json({ error: error || "No code found" }, { status: 400 });
  }

  // 2. 환경변수에서 내 앱의 비밀번호들을 가져옵니다.
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  // 3. 노션 본사에 "진짜 열쇠(Token)"를 달라고 요청합니다. (Basic Auth 인코딩)
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // ★★★ 성공! 여기서 data.access_token (진짜 열쇠)이 나옵니다. ★★★
    // 원래는 여기서 DB에 저장하거나 쿠키에 구워야 합니다.
    // 일단 눈으로 확인하기 위해 토큰을 화면에 보여줍니다.
    console.log("발급된 토큰:", data.access_token);
    
    // 4. (임시) 성공했으면 사용자를 홈페이지로 돌려보냅니다.
    // (나중에는 토큰을 저장하고 "연동 성공!" 메시지를 띄우는 페이지로 보내야 함)
    return NextResponse.redirect(new URL("/?status=success", request.url));

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}