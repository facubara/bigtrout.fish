interface HeliusTokenAccount {
  address: string;
  owner: string;
  amount: number;
  decimals: number;
}

interface HeliusResponse {
  result: {
    token_accounts: HeliusTokenAccount[];
    cursor: string | null;
  };
}

export async function fetchAllHolders(): Promise<Map<string, number>> {
  const apiKey = process.env.HELIUS_API_KEY;
  const mint = process.env.TOKEN_MINT_ADDRESS;

  if (!apiKey) throw new Error("HELIUS_API_KEY is not set");
  if (!mint) throw new Error("TOKEN_MINT_ADDRESS is not set");

  const holders = new Map<string, number>();
  let cursor: string | null = null;

  do {
    const response = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "holders",
          method: "getTokenAccounts",
          params: {
            mint,
            limit: 1000,
            ...(cursor ? { cursor } : {}),
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }

    const data: HeliusResponse = await response.json();

    for (const account of data.result.token_accounts) {
      // Aggregate by owner (wallet may have multiple token accounts)
      const existing = holders.get(account.owner) ?? 0;
      holders.set(account.owner, existing + account.amount);
    }

    cursor = data.result.cursor;
  } while (cursor);

  return holders;
}
