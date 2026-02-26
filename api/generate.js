export default async function handler(req, res) {
  // 1. POST 요청이 아니면 차단합니다.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '잘못된 접근입니다.' });
  }

  // 2. Vercel 환경변수(비밀 금고)에서 API 키를 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY; 
  
  if (!apiKey) {
    return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
  }

  // 3. 앱에서 보낸 사용자의 입력 문장을 받습니다.
  const { currentInput } = req.body;

  if (!currentInput) {
    return res.status(400).json({ error: '입력된 문장이 없습니다.' });
  }

  // 4. AI에게 내릴 정밀한 명령서 세팅
  const promptText = `
You are a trendy English tutor. Convert the following Korean sentence into 3 different English versions.
Korean Input: "${currentInput}"

1. standard: Formal and polite English.
2. native: Casual, natural everyday English.
3. slang: Witty, trendy slang or idioms.

Instruction: Instead of describing the nuance, provide the DIRECT KOREAN TRANSLATION of that specific English sentence to reflect the exact tone.

You MUST respond ONLY with a valid JSON object matching exactly this structure, with no markdown, no formatting, and no extra text:
{
  "standard": {"en": "...", "ko": "...", "tip": "..."},
  "native": {"en": "...", "ko": "...", "tip": "..."},
  "slang": {"en": "...", "ko": "...", "tip": "..."},
  "voca": [{"word": "...", "meaning": "...", "emoji": "..."}]
}`;

  try {
    // 5. 서버가 직접 구글 Gemini AI로 요청을 보냅니다.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    
    if(data.error) throw new Error(data.error.message);

    // 6. JSON 데이터만 안전하게 추출합니다.
    let rawText = data.candidates[0].content.parts[0].text;
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
        throw new Error("AI가 JSON 형태로 대답하지 않았습니다.");
    }
    
    const cleanJson = rawText.substring(jsonStart, jsonEnd);
    const resultData = JSON.parse(cleanJson);

    // 7. 성공적으로 변환된 데이터를 다시 앱으로 던져줍니다.
    return res.status(200).json(resultData);

  } catch (error) {
    console.error("AI Server Error:", error);
    return res.status(500).json({ error: 'AI 번역 중 서버에 문제가 발생했습니다: ' + error.message });
  }
}