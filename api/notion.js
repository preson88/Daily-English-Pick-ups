export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "잘못된 접근입니다." });
  }
  // If client requested publishing to Notion, perform Notion API operations
  if (req.body.notionPublish) {
    // const notionKey = process.env.NOTION_KEY || "";
    const notionKey = "315d872b-594c-81b8-9d2a-003733d37718";
    if (!notionKey.trim()) {
      return res
        .status(500)
        .json({ error: "서버에 NOTION_KEY가 설정되어 있지 않습니다." });
    }

    const {
      currentInput,
      notionPublish,
      resultData,
      dailyDbId,
      sentenceDbId,
      wordDbId,
    } = req.body;
    if (!dailyDbId || !sentenceDbId || !wordDbId) {
      return res.status(400).json({
        error:
          "Notion DB ID들이 요청에 포함되어야 합니다. (dailyDbId, sentenceDbId, wordDbId)",
      });
    }

    try {
      // 1) Create visual page in user's Daily Note DB
      const notionCreateBody = {
        parent: { database_id: dailyDbId },
        properties: {
          Name: {
            title: [{ text: { content: `오늘의 표현: ${currentInput}` } }],
          },
          Date: { date: { start: new Date().toISOString().split("T")[0] } },
        },
        children: [
          {
            object: "block",
            type: "quote",
            quote: {
              rich_text: [{ type: "text", text: { content: currentInput } }],
              color: "gray",
            },
          },
          // Standard callout
          {
            object: "block",
            type: "callout",
            callout: {
              icon: { type: "emoji", emoji: "👔" },
              color: "blue_background",
              rich_text: [
                {
                  type: "text",
                  text: { content: "Standard & Polite\n" },
                  annotations: { bold: true },
                },
                {
                  type: "text",
                  text: {
                    content:
                      resultData.standard && resultData.standard.en
                        ? resultData.standard.en + "\n"
                        : "",
                  },
                },
                {
                  type: "text",
                  text: {
                    content:
                      resultData.standard && resultData.standard.ko
                        ? resultData.standard.ko + "\n"
                        : "",
                  },
                  annotations: { color: "gray" },
                },
                {
                  type: "text",
                  text: {
                    content:
                      "\n💡 팁: " +
                      (resultData.standard && resultData.standard.tip
                        ? resultData.standard.tip
                        : ""),
                  },
                },
              ],
            },
          },
          // Native callout
          {
            object: "block",
            type: "callout",
            callout: {
              icon: { type: "emoji", emoji: "💬" },
              color: "green_background",
              rich_text: [
                {
                  type: "text",
                  text: { content: "Native & Natural\n" },
                  annotations: { bold: true },
                },
                {
                  type: "text",
                  text: {
                    content:
                      resultData.native && resultData.native.en
                        ? resultData.native.en + "\n"
                        : "",
                  },
                },
                {
                  type: "text",
                  text: {
                    content:
                      resultData.native && resultData.native.ko
                        ? resultData.native.ko + "\n"
                        : "",
                  },
                  annotations: { color: "gray" },
                },
                {
                  type: "text",
                  text: {
                    content:
                      "\n💡 팁: " +
                      (resultData.native && resultData.native.tip
                        ? resultData.native.tip
                        : ""),
                  },
                },
              ],
            },
          },
          // Slang callout
          {
            object: "block",
            type: "callout",
            callout: {
              icon: { type: "emoji", emoji: "🔥" },
              color: "purple_background",
              rich_text: [
                {
                  type: "text",
                  text: { content: "Idiom & Slang\n" },
                  annotations: { bold: true },
                },
                {
                  type: "text",
                  text: {
                    content:
                      resultData.slang && resultData.slang.en
                        ? resultData.slang.en + "\n"
                        : "",
                  },
                },
                {
                  type: "text",
                  text: {
                    content:
                      resultData.slang && resultData.slang.ko
                        ? resultData.slang.ko + "\n"
                        : "",
                  },
                  annotations: { color: "gray" },
                },
                {
                  type: "text",
                  text: {
                    content:
                      "\n💡 팁: " +
                      (resultData.slang && resultData.slang.tip
                        ? resultData.slang.tip
                        : ""),
                  },
                },
              ],
            },
          },
          { object: "block", type: "divider", divider: {} },
          {
            object: "block",
            type: "heading_2",
            heading_2: {
              rich_text: [
                {
                  type: "text",
                  text: { content: "줍줍 단어장 (Vocabulary Grid)" },
                },
              ],
            },
          },
          // table block
          {
            object: "block",
            type: "table",
            table: {
              table_width: 2,
              has_column_header: true,
              children: [
                {
                  type: "table_row",
                  table_row: {
                    cells: [
                      [
                        {
                          type: "text",
                          text: { content: "단어/표현" },
                          annotations: { bold: true },
                        },
                      ],
                      [
                        {
                          type: "text",
                          text: { content: "뜻 (Meaning)" },
                          annotations: { bold: true },
                        },
                      ],
                    ],
                  },
                },
              ],
            },
          },
        ],
      };

      // If voca exists, append rows to table via patching children after page creation
      const notionRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notionCreateBody),
      });

      const notionData = await notionRes.json();
      if (notionData.error)
        throw new Error(
          notionData.error.message || "Notion page creation failed",
        );

      const createdPageId = notionData.id;

      // 2) Create sentence entries (one per style)
      const createSentence = async (en, ko, typeName) => {
        return fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${notionKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent: { database_id: sentenceDbId },
            properties: {
              English: { title: [{ text: { content: en || "" } }] },
              Korean: { rich_text: [{ text: { content: ko || "" } }] },
              Type: { select: { name: typeName } },
              "Linked Sentences": { relation: [{ id: createdPageId }] },
            },
          }),
        });
      };

      const sentenceCreates = [];
      if (resultData.standard && resultData.standard.en)
        sentenceCreates.push(
          createSentence(
            resultData.standard.en,
            resultData.standard.ko,
            "Standard",
          ),
        );
      if (resultData.native && resultData.native.en)
        sentenceCreates.push(
          createSentence(resultData.native.en, resultData.native.ko, "Native"),
        );
      if (resultData.slang && resultData.slang.en)
        sentenceCreates.push(
          createSentence(resultData.slang.en, resultData.slang.ko, "Slang"),
        );

      const sentenceResults = await Promise.all(
        sentenceCreates.map((p) => p.then((r) => r.json())),
      );

      // 3) Create word entries
      const vocaList = Array.isArray(resultData.voca) ? resultData.voca : [];
      const createWord = async (wordObj) => {
        return fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${notionKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            parent: { database_id: wordDbId },
            properties: {
              Word: { title: [{ text: { content: wordObj.word || "" } }] },
              Meaning: {
                rich_text: [{ text: { content: wordObj.meaning || "" } }],
              },
              "Linked Words": { relation: [{ id: createdPageId }] },
            },
          }),
        });
      };

      const wordCreates = vocaList.map((v) => createWord(v));
      const wordResults = await Promise.all(
        wordCreates.map((p) => p.then((r) => r.json())),
      );

      return res.status(200).json({
        ...resultData,
        notion: {
          pageId: createdPageId,
          sentences: sentenceResults,
          words: wordResults,
        },
      });
    } catch (notionErr) {
      console.error("Notion Error:", notionErr);
      return res.status(500).json({
        error:
          "Notion 연동 중 오류가 발생했습니다: " +
          (notionErr.message || notionErr),
      });
    }
  }
}
