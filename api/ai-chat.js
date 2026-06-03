module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { staff, message, conversationId } = req.body;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const apiKey     = process.env.MAIAGENT_API_KEY;
  const chatbotId  = process.env.MAIAGENT_CHATBOT_ID;

  if (!apiKey || !chatbotId) {
    return res.status(500).json({ success: false, error: '缺少 MAIAGENT_API_KEY 或 MAIAGENT_CHATBOT_ID 環境變數' });
  }
  if (!staff || !message) {
    return res.status(400).json({ success: false, error: '缺少 staff 或 message 參數' });
  }

  const sbHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };
  const enc = encodeURIComponent;

  try {
    // 平行讀取 OGSM 資料
    const [objRes, goalRes, stratRes, actRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/objectives?select=*&staff=eq.${enc(staff)}`, { headers: sbHeaders }),
      fetch(`${supabaseUrl}/rest/v1/goals?select=*&staff=eq.${enc(staff)}`, { headers: sbHeaders }),
      fetch(`${supabaseUrl}/rest/v1/strategies?select=*&staff=eq.${enc(staff)}`, { headers: sbHeaders }),
      fetch(`${supabaseUrl}/rest/v1/actions?select=*&staff=eq.${enc(staff)}`, { headers: sbHeaders })
    ]);

    const [objectives, goals, strategies, actions] = await Promise.all([
      objRes.json(), goalRes.json(), stratRes.json(), actRes.json()
    ]);

    // 組成 OGSM context 字串（格式同 GAS 版本）
    const ctxLines = ['# Current User Data', `當前職員：${staff}`, '', '## OGSM 資料'];
    for (const obj of (objectives || [])) {
      ctxLines.push(`- 目標：${obj.title || ''}`);
      for (const goal of (goals || []).filter(g => g.objective_id === obj.id)) {
        ctxLines.push(`  - 支線：${goal.name || ''}（進度 ${goal.progress || 0}%）`);
        for (const strat of (strategies || []).filter(s => s.goal_id === goal.id)) {
          ctxLines.push(`    - 策略：${strat.name || ''}${strat.status ? `（${strat.status}）` : ''}`);
          for (const act of (actions || []).filter(a => a.goal_id === goal.id && a.strategy_name === strat.name)) {
            ctxLines.push(`      - 行動：${act.action_name || ''}（負責人：${act.assignee || ''}，截止：${act.due_date || ''}，狀態：${act.status || ''}）`);
          }
        }
      }
    }

    const fullMessage = ctxLines.join('\n') + '\n\n---\n\n' + message;

    const maiBody = Object.assign(
      { message: { content: fullMessage }, is_streaming: false },
      conversationId ? { conversation: conversationId } : {}
    );

    const maiRes = await fetch(
      `https://api.maiagent.ai/api/v1/chatbots/${chatbotId}/completions/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Api-Key ${apiKey}`
        },
        body: JSON.stringify(maiBody)
      }
    );

    const aiData = await maiRes.json();
    if (maiRes.status === 200 || maiRes.status === 201) {
      const reply = aiData.content ||
                    (aiData.message && aiData.message.content) ||
                    aiData.answer || aiData.text || aiData.reply ||
                    JSON.stringify(aiData);
      const convId = aiData.conversationId || aiData.conversation || null;
      return res.json({ success: true, reply, conversationId: convId });
    }
    return res.json({ success: false, error: `AI API 回傳錯誤 ${maiRes.status}: ${JSON.stringify(aiData)}` });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
