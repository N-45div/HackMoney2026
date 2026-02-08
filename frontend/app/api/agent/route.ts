import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { creditInfo, userAddress } = await request.json()

    // Calculate utilization
    const borrowed = BigInt(creditInfo.borrowed)
    const limit = BigInt(creditInfo.creditLimit)
    const utilization = limit > 0n ? Number((borrowed * 10000n) / limit) / 100 : 0

    // Construct prompt for the LLM Agent
    const prompt = `
You are a DeFi Risk Management Agent for the NitroBridge Vault protocol.
Your job is to monitor user credit lines and prevent liquidation.

User Address: ${userAddress}
Current Utilization: ${utilization}%
Liquidation Threshold: 80%
Warning Threshold: 50%

Rules:
1. If utilization > 70%, IMMEDIATE TOP-UP REQUIRED.
2. If utilization > 50%, ADVISE TOP-UP.
3. If utilization < 50%, MONITORING ONLY.

Analyze the situation and decide if a top-up is needed.
Respond with a JSON object ONLY:
{
  "action": "TOP_UP" | "MONITOR",
  "reason": "Brief explanation of your decision",
  "amount": "Recommended top-up amount in USDC (integer)"
}
`

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
    
    // Fallback if no API key (for demo purposes without key)
    if (!OPENROUTER_API_KEY) {
      console.warn('No OPENROUTER_API_KEY found, using rule-based fallback')
      const action = utilization > 50 ? "TOP_UP" : "MONITOR"
      return NextResponse.json({
        action,
        reason: utilization > 50 
          ? `Utilization is ${utilization}%, exceeding safety threshold.` 
          : `Utilization ${utilization}% is healthy.`,
        amount: utilization > 50 ? "100" : "0"
      })
    }

    // Call OpenRouter LLM
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nitrobridge.vercel.app", // Optional: Site URL for rankings
        "X-Title": "NitroBridge Vault", // Optional: Site title for rankings
      },
      body: JSON.stringify({
        "model": "nvidia/nemotron-nano-9b-v2:free",
        "messages": [
          {
            "role": "system", 
            "content": "You are a DeFi Risk Management Agent. You must output VALID JSON only. Do not output markdown blocks or explanations outside the JSON."
          },
          {"role": "user", "content": prompt}
        ],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json()
    
    // Handle OpenRouter API errors
    if (!response.ok || data.error) {
      console.error('OpenRouter API error:', data.error || response.statusText)
      // Fallback to rule-based on API error
      const action = utilization > 50 ? "TOP_UP" : "MONITOR"
      return NextResponse.json({
        action,
        reason: `LLM unavailable — rule-based fallback. Utilization is ${utilization}%.`,
        amount: utilization > 50 ? "10" : "0",
        source: "fallback"
      })
    }

    // Validate response structure
    if (!data.choices || !data.choices.length || !data.choices[0]?.message?.content) {
      console.error('Unexpected OpenRouter response:', JSON.stringify(data).slice(0, 500))
      const action = utilization > 50 ? "TOP_UP" : "MONITOR"
      return NextResponse.json({
        action,
        reason: `LLM returned unexpected format — rule-based fallback. Utilization is ${utilization}%.`,
        amount: utilization > 50 ? "10" : "0",
        source: "fallback"
      })
    }

    const content = data.choices[0].message.content
    
    // Parse JSON from LLM response (handling potential markdown code blocks)
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
    const decision = JSON.parse(jsonStr)
    decision.source = "llm"

    return NextResponse.json(decision)

  } catch (error) {
    console.error('Agent Error:', error)
    // Always return a valid response, never 500
    return NextResponse.json({
      action: "MONITOR",
      reason: "Agent encountered an error. Defaulting to monitor.",
      amount: "0",
      source: "error-fallback"
    })
  }
}
