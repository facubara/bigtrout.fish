import { Connection } from "@solana/web3.js";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      throw new Error("SOLANA_RPC_URL environment variable is not set");
    }
    _connection = new Connection(rpcUrl, "confirmed");
  }
  return _connection;
}
