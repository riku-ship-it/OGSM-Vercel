module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { weekRange, members, statusCounts } = req.body;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const apiKey    = process.env.MAIAGENT_API_KEY;
  const chatbotId = process.env.MAIAGENT_CHATBOT_ID;

  if (!apiKey || !chatbotId) {
    return res.status(500).json({ success: false, error: '缺少 MAIAGENT_API_KEY 或 MAIAGENT_CHATBOT_ID 環境變數' });
  }

  const sc = statusCounts || {};
  const lines = [
    '你是一位專業的部門週報摘要助理。請根據以下本週部門資料，產生一份簡潔有力的部門週報摘要。',
    '請用繁體中文回覆，使用 Markdown 格式，依序包含以下四個段落：',
    '## 1. 各人本週進度總結',
    '## 2. 部門整體狀況',
    '## 3. 值得關注的風險點',
    '## 4. 下週建議',
    '',
    '===== 本週資料 =====',
    `週次：${weekRange}`,
    '',
    '【部門行動狀態統計】',
    `未開始：${sc['未開始'] || 0} 項`,
    `進行中：${sc['進行中'] || 0} 項`,
    `卡關：${sc['卡關']   || 0} 項`,
    `完成：${sc['完成']   || 0} 項`,
    ''
  ];

  for (const m of (members || [])) {
    lines.push(`【${m.name}】`);
    if (m.selectedActions && m.selectedActions.length > 0) {
      lines.push('本週選取行動：');
      for (const a of m.selectedActions) {
        lines.push(`  - ${a.action_name}（狀態：${a.status}${a.assignee ? `，負責人：${a.assignee}` : ''}）`);
      }
    } else {
      lines.push('本週未選取行動項目');
    }
    if (m.memberNote) lines.push(`備注：${m.memberNote}`);
    if (m.weekNote)   lines.push(`本週成果/問題：${m.weekNote}`);
    lines.push('');
  }

  try {
    const maiRes = await fetch(
      `https://api.maiagent.ai/api/v1/chatbots/${chatbotId}/completions/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify({ message: { content: lines.join('\n') }, is_streaming: false })
      }
    );

    const aiData = await maiRes.json();
    if (maiRes.status !== 200 && maiRes.status !== 201) {
      return res.json({ success: false, error: `AI API 錯誤 ${maiRes.status}: ${JSON.stringify(aiData)}` });
    }

    const summary = aiData.content ||
                    (aiData.message && aiData.message.content) ||
                    aiData.answer || aiData.text || aiData.reply || '';

    // 儲存摘要至 Supabase meeting_notes
    const weekKey = (weekRange || '').split(' ~ ')[0].trim();
    const sbHeaders = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };
    await fetch(`${supabaseUrl}/rest/v1/meeting_notes`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify({
        note_type: 'ai_summary',
        week_key: weekKey,
        member: null,
        content: summary
      })
    });

    return res.json({ success: true, summary });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
