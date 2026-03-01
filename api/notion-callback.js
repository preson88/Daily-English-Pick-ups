export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("No code provided");
  }

  const encoded = Buffer.from(
    `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.NOTION_REDIRECT_URI,
    }),
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    return res.status(400).json(data);
  }

  const accessToken = data.access_token;

  // 🔥 토큰을 URL에 실어 브라우저로 전달
  res.redirect(`/?notion_token=${accessToken}`);
}
